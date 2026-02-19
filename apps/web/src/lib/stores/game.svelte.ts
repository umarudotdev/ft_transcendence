import type { InputState } from "$lib/game/input";
import type {
  BulletRenderState,
  EffectRenderState,
  PlayerRenderState,
} from "$lib/game/renderer";

import { api } from "$lib/api";
import { createInterpolator } from "$lib/game/interpolation";
import { Callbacks, Client, type Room } from "@colyseus/sdk";

// Matchmaking WS message types (mirrors API types)
type MatchmakingServerMessage =
  | { type: "queue_joined"; position: number; estimatedWait: number }
  | { type: "queue_update"; position: number; estimatedWait: number }
  | {
      type: "match_found";
      matchSessionId: string;
      joinToken: string;
      opponent: {
        id: number;
        displayName: string;
        rating: number;
        tier: string;
      };
    }
  | {
      type: "match_complete";
      result: { won: boolean; ratingChange: number; newRating: number };
    }
  | { type: "error"; error: string };

export type GamePhase =
  | "idle"
  | "queuing"
  | "matched"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "reconnecting"
  | "finished";

export interface MatchResult {
  won: boolean;
  ratingChange: number;
  newRating: number;
}

export interface OpponentInfo {
  id: number;
  displayName: string;
  rating: number;
  tier: string;
}

function getMatchmakingWsUrl(token: string): string {
  if (import.meta.env.DEV) {
    return `ws://localhost:3000/api/matchmaking/ws?token=${encodeURIComponent(token)}`;
  }
  // In production, connect directly to the API server (SvelteKit can't proxy WebSockets)
  const apiUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsUrl = apiUrl.replace(/^http/, "ws");
  return `${wsUrl}/api/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getGameServerUrl(): string {
  if (import.meta.env.DEV) {
    return "ws://localhost:2567";
  }
  // In production, use the GAME_URL env var injected by SvelteKit
  return import.meta.env.VITE_GAME_URL ?? "ws://localhost:2567";
}

// --- Session persistence for page reload resilience ---

const RECONNECTION_KEY = "ft_game_reconnection";

interface ReconnectionData {
  reconnectionToken: string;
  matchSessionId: string;
  opponent: OpponentInfo;
  queueMode: "ranked" | "casual";
}

function saveReconnectionData(data: ReconnectionData) {
  try {
    sessionStorage.setItem(RECONNECTION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable (SSR, private browsing quota)
  }
}

function loadReconnectionData(): ReconnectionData | null {
  try {
    const raw = sessionStorage.getItem(RECONNECTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReconnectionData;
  } catch {
    return null;
  }
}

function clearReconnectionData() {
  try {
    sessionStorage.removeItem(RECONNECTION_KEY);
  } catch {
    // ignore
  }
}

/** Phase ordering for forward-only transitions (higher = later in lifecycle) */
const PHASE_ORDER: Record<GamePhase, number> = {
  idle: 0,
  queuing: 1,
  matched: 2,
  connecting: 3,
  waiting: 4,
  countdown: 5,
  playing: 6,
  reconnecting: 6, // same level as playing (lateral transition)
  finished: 7,
};

export function createGameStore() {
  // --- Reactive state ---
  let phase: GamePhase = $state("idle");
  let queuePosition = $state(0);
  let estimatedWait = $state(0);
  let queueMode: "ranked" | "casual" | null = $state(null);
  let opponent: OpponentInfo | null = $state(null);
  let matchSessionId: string | null = $state(null);
  let joinToken: string | null = $state(null);
  let players: Map<string, PlayerRenderState> = $state(new Map());
  let bullets: BulletRenderState[] = $state([]);
  let effects: EffectRenderState[] = $state([]);
  let gameTick = $state(0);
  let countdownTimer = $state(0);
  let winnerId = $state("");
  let matchResult: MatchResult | null = $state(null);
  let mySessionId: string | null = $state(null);

  // --- Internal guards (non-reactive) ---
  let _joiningLock = false;
  let _readySent = false;
  let _matchmakingWs: WebSocket | null = null;
  let _currentRoom: Room | null = null;

  const interpolator = createInterpolator();

  // --- Helpers ---

  function resetGameState() {
    players = new Map();
    bullets = [];
    effects = [];
    gameTick = 0;
    countdownTimer = 0;
    winnerId = "";
    matchResult = null;
    mySessionId = null;
    matchSessionId = null;
    joinToken = null;
    opponent = null;
    queueMode = null;
    _readySent = false;
    interpolator.clear();
  }

  // --- Matchmaking ---

  async function joinQueue(
    mode: "ranked" | "casual" = "ranked",
    retried = false
  ) {
    if (phase !== "idle" || _joiningLock) return;
    _joiningLock = true;

    phase = "queuing";
    queueMode = mode;

    try {
      const { data, error, status } = await api.api.matchmaking.queue.post({
        mode,
      });

      // Already in queue (stale server state) — leave and retry once
      if (status === 409 && !retried) {
        await api.api.matchmaking.queue.delete();
        phase = "idle";
        queueMode = null;
        _joiningLock = false;
        return joinQueue(mode, true);
      }

      if (error || !data) {
        phase = "idle";
        queueMode = null;
        return;
      }

      // User might have cancelled while we were awaiting the API call
      if (phase !== "queuing") return;

      const response = data as {
        position: number;
        estimatedWait: number;
        wsToken: string;
      };
      queuePosition = response.position;
      estimatedWait = response.estimatedWait;

      // Open matchmaking WS using the server-issued token
      connectMatchmakingWs(response.wsToken);
    } catch {
      if (phase === "queuing") {
        phase = "idle";
        queueMode = null;
      }
    } finally {
      _joiningLock = false;
    }
  }

  function leaveQueue() {
    if (phase !== "queuing") return;

    api.api.matchmaking.queue.delete().catch(() => {});
    disconnectMatchmakingWs();
    phase = "idle";
    queueMode = null;
  }

  function connectMatchmakingWs(token: string) {
    disconnectMatchmakingWs();

    const url = getMatchmakingWsUrl(token);

    try {
      const ws = new WebSocket(url);
      _matchmakingWs = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MatchmakingServerMessage;
          handleMatchmakingMessage(message);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (_matchmakingWs === ws) {
          _matchmakingWs = null;
        }
      };
    } catch {
      // Connection failed
    }
  }

  function disconnectMatchmakingWs() {
    if (_matchmakingWs) {
      _matchmakingWs.close();
      _matchmakingWs = null;
    }
  }

  function handleMatchmakingMessage(message: MatchmakingServerMessage) {
    switch (message.type) {
      case "queue_joined":
      case "queue_update": {
        if (phase === "queuing") {
          queuePosition = message.position;
          estimatedWait = message.estimatedWait;
        }
        break;
      }
      case "match_found": {
        if (phase !== "queuing") break;
        disconnectMatchmakingWs();
        opponent = message.opponent;
        matchSessionId = message.matchSessionId;
        joinToken = message.joinToken;
        phase = "matched";
        break;
      }
      case "match_complete": {
        // Delivered via matchmaking WS — but WS is closed before game ends,
        // so this is unlikely to arrive. matchResult is now primarily set
        // via Colyseus broadcast. Keep as fallback.
        if (phase === "finished") {
          matchResult = message.result;
        }
        break;
      }
      case "error": {
        disconnectMatchmakingWs();
        if (phase === "queuing") {
          phase = "idle";
          queueMode = null;
        }
        break;
      }
    }
  }

  // --- Colyseus Game Connection ---

  async function joinGame() {
    if (phase !== "matched" || !matchSessionId || !joinToken) return;

    phase = "connecting";

    // Consume the token locally to prevent double-use
    const token = joinToken;
    joinToken = null;

    try {
      const client = new Client(getGameServerUrl());

      const joinedRoom = await client.joinOrCreate("game_room", {
        matchSessionId,
        joinToken: token,
      });

      // If user navigated away or called disconnect() while connecting
      if (phase !== "connecting") {
        joinedRoom.leave().catch(() => {});
        return;
      }

      _currentRoom = joinedRoom;
      mySessionId = joinedRoom.sessionId;
      _readySent = false;

      // Configure reconnection
      joinedRoom.reconnection.maxRetries = 15;
      joinedRoom.reconnection.maxDelay = 5000;

      // Persist for page reload resilience
      if (matchSessionId && opponent && queueMode) {
        saveReconnectionData({
          reconnectionToken: joinedRoom.reconnectionToken,
          matchSessionId,
          opponent,
          queueMode,
        });
      }

      phase = "waiting";
      setupRoomCallbacks(joinedRoom);
    } catch {
      phase = "idle";
      resetGameState();
    }
  }

  async function reconnectToGame() {
    const saved = loadReconnectionData();
    if (!saved || phase !== "idle") return;

    phase = "reconnecting";
    matchSessionId = saved.matchSessionId;
    opponent = saved.opponent;
    queueMode = saved.queueMode;

    try {
      const client = new Client(getGameServerUrl());
      const joinedRoom = await client.reconnect(saved.reconnectionToken);

      // If user navigated away while reconnecting
      if (phase !== "reconnecting") {
        joinedRoom.leave().catch(() => {});
        return;
      }

      _currentRoom = joinedRoom;
      mySessionId = joinedRoom.sessionId;
      _readySent = false;

      joinedRoom.reconnection.maxRetries = 15;
      joinedRoom.reconnection.maxDelay = 5000;

      // Update stored token (changes after reconnect)
      saveReconnectionData({
        ...saved,
        reconnectionToken: joinedRoom.reconnectionToken,
      });

      setupRoomCallbacks(joinedRoom);
      // Phase will advance via onStateChange from server state sync
    } catch {
      clearReconnectionData();
      phase = "idle";
      resetGameState();
    }
  }

  function setupRoomCallbacks(joinedRoom: Room) {
    // Use type assertion for callbacks since we work with untyped room state.
    // Colyseus SDK's strict generics require the schema type, but we sync
    // state manually via Record<string, unknown> casting.
    // biome-ignore lint/suspicious/noExplicitAny: Colyseus untyped state callbacks
    const cb = Callbacks.get(joinedRoom) as any;

    function extractPlayer(p: Record<string, unknown>): PlayerRenderState {
      return {
        x: (p.x as number) ?? 0,
        y: (p.y as number) ?? 0,
        hp: (p.hp as number) ?? 100,
        lives: (p.lives as number) ?? 3,
        score: (p.score as number) ?? 0,
        playerIndex: (p.playerIndex as number) ?? 0,
        connected: (p.connected as boolean) ?? true,
        isFocusing: (p.isFocusing as boolean) ?? false,
        isDashing: (p.isDashing as boolean) ?? false,
        isShielded: (p.isShielded as boolean) ?? false,
        invincibleUntil: (p.invincibleUntil as number) ?? 0,
        ultimateCharge: (p.ultimateCharge as number) ?? 0,
        ability1CooldownUntil: (p.ability1CooldownUntil as number) ?? 0,
        ability2CooldownUntil: (p.ability2CooldownUntil as number) ?? 0,
        aimAngle: (p.aimAngle as number) ?? 0,
      };
    }

    // Player state sync
    cb.onAdd(
      "players",
      (player: Record<string, unknown>, sessionId: string) => {
        if (_currentRoom !== joinedRoom) return;
        const p = extractPlayer(player);
        players.set(sessionId, p);
        players = new Map(players);
        interpolator.pushSnapshot(sessionId, p.x, p.y);

        cb.onChange(player, () => {
          if (_currentRoom !== joinedRoom) return;
          const updated = extractPlayer(player);
          players.set(sessionId, updated);
          players = new Map(players);
          interpolator.pushSnapshot(sessionId, updated.x, updated.y);
        });
      }
    );

    cb.onRemove("players", (_player: unknown, sessionId: string) => {
      if (_currentRoom !== joinedRoom) return;
      players.delete(sessionId);
      players = new Map(players);
      interpolator.removeEntity(sessionId);
    });

    // Bullets sync — rebuilt every state change, onAdd used for initial setup
    cb.onAdd("bullets", () => {});

    // Effects sync — rebuilt every state change
    cb.onAdd("effects", () => {});

    // Full state sync
    joinedRoom.onStateChange((rawState: unknown) => {
      if (_currentRoom !== joinedRoom) return;

      const state = rawState as Record<string, unknown>;
      gameTick = (state.tick as number) ?? 0;
      countdownTimer = (state.countdownTimer as number) ?? 0;
      winnerId = (state.winnerId as string) ?? "";

      // Forward-only phase advancement from server
      const serverPhase = state.phase as string;
      if (
        serverPhase === "waiting" ||
        serverPhase === "countdown" ||
        serverPhase === "playing" ||
        serverPhase === "finished"
      ) {
        const currentOrder = PHASE_ORDER[phase] ?? 0;
        const newOrder = PHASE_ORDER[serverPhase as GamePhase] ?? 0;
        // Allow "reconnecting" to accept any server phase (page reload reconnect)
        if (newOrder > currentOrder || phase === "reconnecting") {
          phase = serverPhase as GamePhase;
        }
      }

      // Drain buffered matchResult if we just entered "finished"
      if (phase === "finished" && pendingMatchResult) {
        const data = pendingMatchResult;
        pendingMatchResult = null;
        applyMatchResult(data);
      }

      // Rebuild bullets array from state
      // Note: Colyseus ArraySchema is not a native Array, so Array.isArray() returns false.
      // Use Array.from() to convert any iterable schema collection.
      const stateBullets = state.bullets;
      if (stateBullets) {
        bullets = Array.from(
          stateBullets as Iterable<Record<string, unknown>>
        ).map((b) => ({
          x: (b.x as number) ?? 0,
          y: (b.y as number) ?? 0,
          ownerId: (b.ownerId as string) ?? "",
          damage: (b.damage as number) ?? 10,
        }));
      }

      // Rebuild effects array from state
      const stateEffects = state.effects;
      if (stateEffects) {
        effects = Array.from(
          stateEffects as Iterable<Record<string, unknown>>
        ).map((e) => ({
          effectType: (e.effectType as string) ?? "",
          x: (e.x as number) ?? 0,
          y: (e.y as number) ?? 0,
          radius: (e.radius as number) ?? 0,
        }));
      }
    });

    // Server broadcast messages
    joinedRoom.onMessage("assignPlayer", () => {});
    joinedRoom.onMessage("countdown", () => {});
    joinedRoom.onMessage("abilityUsed", () => {});
    joinedRoom.onMessage("hit", () => {});
    joinedRoom.onMessage("gameOver", () => {});

    // Match result from Colyseus broadcast (replaces broken matchmaking WS path).
    // The message may arrive before the "finished" state patch, so buffer it.
    type MatchResultPayload = {
      winnerId: number | null;
      players: Record<number, { ratingChange: number; score: number }>;
      duration: number;
    };
    let pendingMatchResult: MatchResultPayload | null = null;

    function applyMatchResult(data: MatchResultPayload) {
      if (matchResult) return; // Already applied

      const opponentUserId = opponent?.id;
      let ratingChange = 0;

      for (const [playerIdStr, playerData] of Object.entries(data.players)) {
        if (Number(playerIdStr) !== opponentUserId) {
          ratingChange = playerData.ratingChange;
          break;
        }
      }

      matchResult = {
        won: winnerId !== "" && winnerId === mySessionId,
        ratingChange,
        newRating: 0,
      };

      // Fetch actual post-match rating from API
      api.api.rankings.me
        .get()
        .then(({ data: rankingData }) => {
          const rating = (
            rankingData as { ranking?: { rating?: number } } | null
          )?.ranking?.rating;
          if (rating != null && matchResult) {
            matchResult = { ...matchResult, newRating: rating };
          }
        })
        .catch(() => {});
    }

    joinedRoom.onMessage("matchResult", (data: MatchResultPayload) => {
      if (_currentRoom !== joinedRoom) return;

      if (phase === "finished") {
        applyMatchResult(data);
      } else {
        pendingMatchResult = data;
      }
    });

    // Connection events
    joinedRoom.onDrop(() => {
      if (_currentRoom !== joinedRoom) return;
      phase = "reconnecting";
    });

    joinedRoom.onReconnect(() => {
      if (_currentRoom !== joinedRoom) return;
      if (phase === "reconnecting") {
        phase = "playing";
      }
      // Update stored token (may change after auto-reconnect)
      const saved = loadReconnectionData();
      if (saved) {
        saveReconnectionData({
          ...saved,
          reconnectionToken: joinedRoom.reconnectionToken,
        });
      }
    });

    joinedRoom.onLeave(() => {
      if (_currentRoom !== joinedRoom) return;
      // Don't reset if finished (user sees result screen and cleans up via disconnect)
      if (phase !== "finished") {
        _currentRoom = null;
        phase = "idle";
        resetGameState();
        clearReconnectionData();
      }
    });
  }

  // --- Input ---

  function sendInput(input: InputState) {
    _currentRoom?.send("input", input);
  }

  function sendAbility(slot: number) {
    if (phase !== "playing") return;
    _currentRoom?.send("ability", { slot });
  }

  function sendReady() {
    if (phase !== "waiting" || _readySent) return;
    _readySent = true;
    _currentRoom?.send("ready", {});
  }

  // --- Cleanup ---

  async function disconnect() {
    disconnectMatchmakingWs();
    clearReconnectionData();

    const roomToLeave = _currentRoom;
    _currentRoom = null;

    // Reset state immediately (before await) to prevent race conditions
    phase = "idle";
    resetGameState();

    // Wait for room to actually disconnect
    if (roomToLeave) {
      try {
        await roomToLeave.leave();
      } catch {
        // Room might already be disconnected
      }
    }
  }

  /** Reset to idle if in a terminal state (e.g. navigating back to /play after a game) */
  function resetIfStale() {
    if (phase === "finished") {
      const roomToLeave = _currentRoom;
      _currentRoom = null;
      phase = "idle";
      resetGameState();
      clearReconnectionData();
      if (roomToLeave) {
        roomToLeave.leave().catch(() => {});
      }
    }
  }

  // --- Player getters ---

  function getMyPlayer(): PlayerRenderState | null {
    if (!mySessionId) return null;
    return players.get(mySessionId) ?? null;
  }

  function getOpponentPlayer(): PlayerRenderState | null {
    if (!mySessionId) return null;
    for (const [sid, player] of players) {
      if (sid !== mySessionId) return player;
    }
    return null;
  }

  return {
    // State
    get phase() {
      return phase;
    },
    get queuePosition() {
      return queuePosition;
    },
    get estimatedWait() {
      return estimatedWait;
    },
    get opponent() {
      return opponent;
    },
    get matchSessionId() {
      return matchSessionId;
    },
    get joinToken() {
      return joinToken;
    },
    get queueMode() {
      return queueMode;
    },
    get players() {
      return players;
    },
    get bullets() {
      return bullets;
    },
    get effects() {
      return effects;
    },
    get gameTick() {
      return gameTick;
    },
    get countdownTimer() {
      return countdownTimer;
    },
    get winnerId() {
      return winnerId;
    },
    get matchResult() {
      return matchResult;
    },
    get mySessionId() {
      return mySessionId;
    },
    get interpolator() {
      return interpolator;
    },
    // Methods
    joinQueue,
    leaveQueue,
    joinGame,
    reconnectToGame,
    sendInput,
    sendAbility,
    sendReady,
    disconnect,
    resetIfStale,
    getMyPlayer,
    getOpponentPlayer,
  };
}

// Singleton
let gameStoreInstance: ReturnType<typeof createGameStore> | null = null;

export function getGameStore() {
  if (!gameStoreInstance) {
    gameStoreInstance = createGameStore();
  }
  return gameStoreInstance;
}
