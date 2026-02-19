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

export function createGameStore() {
  // --- Matchmaking state ---
  let matchmakingWs: WebSocket | null = $state(null);
  let queuePosition = $state(0);
  let estimatedWait = $state(0);
  let opponent: OpponentInfo | null = $state(null);
  let matchSessionId: string | null = $state(null);
  let joinToken: string | null = $state(null);
  let queueMode: "ranked" | "casual" | null = $state(null);

  // --- Game state ---
  let phase: GamePhase = $state("idle");
  let room: Room | null = $state(null);
  let mySessionId: string | null = $state(null);
  let players: Map<string, PlayerRenderState> = $state(new Map());
  let bullets: BulletRenderState[] = $state([]);
  let effects: EffectRenderState[] = $state([]);
  let gameTick = $state(0);
  let countdownTimer = $state(0);
  let winnerId = $state("");
  let matchResult: MatchResult | null = $state(null);

  const interpolator = createInterpolator();

  // --- Matchmaking ---

  async function joinQueue(
    mode: "ranked" | "casual" = "ranked",
    retried = false
  ) {
    phase = "queuing";
    queueMode = mode;

    try {
      const { data, error, status } = await api.api.matchmaking.queue.post({
        mode,
      });

      // Already in queue (stale server state) — leave and retry once
      if (status === 409 && !retried) {
        await api.api.matchmaking.queue.delete();
        return joinQueue(mode, true);
      }

      if (error || !data) {
        phase = "idle";
        return;
      }

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
      phase = "idle";
    }
  }

  function leaveQueue() {
    api.api.matchmaking.queue.delete().catch(() => {});

    disconnectMatchmakingWs();
    phase = "idle";
    queueMode = null;
  }

  function connectMatchmakingWs(token: string) {
    const url = getMatchmakingWsUrl(token);

    try {
      matchmakingWs = new WebSocket(url);

      matchmakingWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MatchmakingServerMessage;
          handleMatchmakingMessage(message);
        } catch {
          // ignore parse errors
        }
      };

      matchmakingWs.onclose = () => {
        matchmakingWs = null;
      };
    } catch {
      // Connection failed
    }
  }

  function disconnectMatchmakingWs() {
    if (matchmakingWs) {
      matchmakingWs.close();
      matchmakingWs = null;
    }
  }

  function handleMatchmakingMessage(message: MatchmakingServerMessage) {
    switch (message.type) {
      case "queue_joined":
      case "queue_update": {
        queuePosition = message.position;
        estimatedWait = message.estimatedWait;
        break;
      }
      case "match_found": {
        opponent = message.opponent;
        matchSessionId = message.matchSessionId;
        joinToken = message.joinToken;
        phase = "matched";
        disconnectMatchmakingWs();
        break;
      }
      case "match_complete": {
        matchResult = message.result;
        phase = "finished";
        break;
      }
      case "error": {
        phase = "idle";
        break;
      }
    }
  }

  // --- Colyseus Game Connection ---

  async function joinGame() {
    if (!matchSessionId || !joinToken || phase === "connecting") return;

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

      room = joinedRoom;
      mySessionId = joinedRoom.sessionId;

      // Configure reconnection
      joinedRoom.reconnection.maxRetries = 15;
      joinedRoom.reconnection.maxDelay = 5000;

      setupRoomCallbacks(joinedRoom);
    } catch (error) {
      console.error("[game] joinOrCreate failed:", error);
      phase = "idle";
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
      };
    }

    // Player state sync
    cb.onAdd(
      "players",
      (player: Record<string, unknown>, sessionId: string) => {
        const p = extractPlayer(player);
        players.set(sessionId, p);
        players = new Map(players);
        interpolator.pushSnapshot(sessionId, p.x, p.y);

        cb.onChange(player, () => {
          const updated = extractPlayer(player);
          players.set(sessionId, updated);
          players = new Map(players);
          interpolator.pushSnapshot(sessionId, updated.x, updated.y);
        });
      }
    );

    cb.onRemove("players", (_player: unknown, sessionId: string) => {
      players.delete(sessionId);
      players = new Map(players);
      interpolator.removeEntity(sessionId);
    });

    // Bullets sync — rebuilt every state change, onAdd used for initial setup
    cb.onAdd("bullets", () => {});

    // Effects sync — rebuilt every state change
    cb.onAdd("effects", () => {});

    // Full state sync
    joinedRoom.onStateChange.once((rawState: unknown) => {
      const state = rawState as Record<string, unknown>;
      phase = (state.phase as GamePhase) ?? "waiting";
    });

    joinedRoom.onStateChange((rawState: unknown) => {
      const state = rawState as Record<string, unknown>;
      gameTick = (state.tick as number) ?? 0;
      countdownTimer = (state.countdownTimer as number) ?? 0;
      winnerId = (state.winnerId as string) ?? "";

      const newPhase = (state.phase as string) ?? "waiting";
      if (
        newPhase === "playing" ||
        newPhase === "countdown" ||
        newPhase === "waiting" ||
        newPhase === "finished"
      ) {
        phase = newPhase as GamePhase;
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

    // Connection events
    joinedRoom.onDrop(() => {
      phase = "reconnecting";
    });

    joinedRoom.onReconnect(() => {
      if (phase === "reconnecting") {
        phase = "playing";
      }
    });

    joinedRoom.onLeave(() => {
      room = null;
      if (phase !== "finished") {
        phase = "idle";
      }
    });
  }

  // --- Input ---

  function sendInput(input: InputState) {
    room?.send("input", input);
  }

  function sendAbility(slot: number) {
    room?.send("ability", { slot });
  }

  function sendReady() {
    room?.send("ready", {});
  }

  // --- Cleanup ---

  function disconnect() {
    disconnectMatchmakingWs();
    room?.leave();
    room = null;
    phase = "idle";
    players = new Map();
    bullets = [];
    effects = [];
    interpolator.clear();
    matchResult = null;
    matchSessionId = null;
    joinToken = null;
    opponent = null;
    queueMode = null;
  }

  // --- Getters for my player ---

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
    sendInput,
    sendAbility,
    sendReady,
    disconnect,
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
