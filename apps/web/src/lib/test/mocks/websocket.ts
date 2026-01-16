/**
 * Mock WebSocket implementation for frontend store testing.
 * Simulates WebSocket behavior for testing the chat store.
 */

import { vi } from "vitest";

export type MockEventHandler = (event: unknown) => void;

/**
 * Mock WebSocket class for testing
 */
export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;

  // Event handlers
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // Spy functions
  send = vi.fn((data: string) => {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.sentMessages.push(data);
  });

  close = vi.fn((code = 1000, reason = "") => {
    if (
      this.readyState === MockWebSocket.CLOSED ||
      this.readyState === MockWebSocket.CLOSING
    ) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    this._simulateClose(code, reason);
  });

  // Test utilities
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Simulate the connection opening
   */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  /**
   * Simulate receiving a message from the server
   */
  simulateMessage(data: unknown): void {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: message }));
    }
  }

  /**
   * Simulate the connection closing (server-initiated)
   */
  private _simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(
        new CloseEvent("close", {
          code,
          reason,
          wasClean: code === 1000,
        })
      );
    }
  }

  /**
   * Simulate server-initiated close
   */
  simulateServerClose(code = 1000, reason = ""): void {
    this._simulateClose(code, reason);
  }

  /**
   * Simulate an error
   */
  simulateError(): void {
    this.readyState = MockWebSocket.CLOSING;
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
    this._simulateClose(1006, "Connection error");
  }

  /**
   * Get all sent messages as parsed JSON
   */
  getSentMessages<T = unknown>(): T[] {
    return this.sentMessages.map((m) => JSON.parse(m) as T);
  }

  /**
   * Get the last sent message as parsed JSON
   */
  getLastSentMessage<T = unknown>(): T | undefined {
    const last = this.sentMessages.at(-1);
    return last ? (JSON.parse(last) as T) : undefined;
  }

  /**
   * Clear sent messages
   */
  clearSentMessages(): void {
    this.sentMessages = [];
    this.send.mockClear();
  }

  /**
   * Reset all mocks and state
   */
  reset(): void {
    this.readyState = MockWebSocket.CONNECTING;
    this.sentMessages = [];
    this.send.mockClear();
    this.close.mockClear();
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }
}

/**
 * Create a mock WebSocket factory that returns a controlled instance
 */
export function createMockWebSocketFactory() {
  let currentInstance: MockWebSocket | null = null;

  const factory = vi.fn((url: string) => {
    currentInstance = new MockWebSocket(url);
    return currentInstance;
  });

  return {
    factory,
    get currentInstance() {
      return currentInstance;
    },
    reset() {
      currentInstance = null;
      factory.mockClear();
    },
  };
}

/**
 * Install mock WebSocket globally for tests
 */
export function installMockWebSocket(): {
  getInstance: () => MockWebSocket | null;
  restore: () => void;
} {
  const { factory, currentInstance, reset } = createMockWebSocketFactory();
  const originalWebSocket = globalThis.WebSocket;

  globalThis.WebSocket = factory as unknown as typeof WebSocket;

  return {
    getInstance: () => currentInstance,
    restore: () => {
      globalThis.WebSocket = originalWebSocket;
      reset();
    },
  };
}
