import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the API module before importing the store
vi.mock("$lib/api", () => ({
  api: {
    api: {
      matchmaking: {
        queue: {
          post: vi.fn().mockResolvedValue({
            data: { position: 1, estimatedWait: 30 },
            error: null,
          }),
          delete: vi
            .fn()
            .mockResolvedValue({ data: { success: true }, error: null }),
        },
      },
    },
  },
}));

// Mock Colyseus SDK
vi.mock("@colyseus/sdk", () => ({
  Client: vi.fn(),
  Callbacks: { get: vi.fn() },
}));

// Mock cookie access
function mockSessionCookie(sessionId: string | null) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: sessionId ? `session=${sessionId}` : "",
  });
}

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState: number = MockWebSocket.CONNECTING;
  url: string;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(_data: string): void {}

  close(_code = 1000, _reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code: _code, reason: _reason }));
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }
}

// We need to import createGameStore dynamically after mocks are set up
let createGameStore: typeof import("./game.svelte").createGameStore;

describe("game store", () => {
  beforeEach(async () => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockSessionCookie("test-session-id");

    // Dynamic import to ensure mocks are in place
    const mod = await import("./game.svelte");
    createGameStore = mod.createGameStore;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts in idle phase", () => {
    const store = createGameStore();
    expect(store.phase).toBe("idle");
  });

  it("starts with queueMode as null", () => {
    const store = createGameStore();
    expect(store.queueMode).toBeNull();
  });

  it("joinQueue sets queueMode to ranked", async () => {
    const store = createGameStore();
    await store.joinQueue("ranked");
    expect(store.queueMode).toBe("ranked");
  });

  it("joinQueue sets queueMode to casual", async () => {
    const store = createGameStore();
    await store.joinQueue("casual");
    expect(store.queueMode).toBe("casual");
  });

  it("leaveQueue resets queueMode to null", async () => {
    const store = createGameStore();
    await store.joinQueue("ranked");
    store.leaveQueue();
    expect(store.queueMode).toBeNull();
  });

  it("disconnect resets queueMode to null", async () => {
    const store = createGameStore();
    await store.joinQueue("ranked");
    store.disconnect();
    expect(store.queueMode).toBeNull();
  });
});
