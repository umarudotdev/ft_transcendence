/**
 * Mock WebSocket implementation for unit testing.
 * Simulates WebSocket behavior without actual network connections.
 */

export type MessageHandler = (data: string) => void;
export type CloseHandler = (code?: number, reason?: string) => void;

export class MockWebSocket {
  readyState: number = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];
  closeCode?: number;
  closeReason?: string;

  // Static constants matching the real WebSocket
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  private messageHandlers: MessageHandler[] = [];
  private closeHandlers: CloseHandler[] = [];
  private openHandlers: (() => void)[] = [];

  constructor(_url?: string, _protocols?: string | string[]) {
    // Simulate async connection
    setTimeout(() => this.simulateOpen(), 0);
  }

  /**
   * Simulate the connection opening
   */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    for (const handler of this.openHandlers) {
      handler();
    }
  }

  /**
   * Simulate receiving a message from the server
   */
  simulateMessage(data: unknown): void {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  /**
   * Simulate the connection closing (server-initiated)
   */
  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.closeCode = code;
    this.closeReason = reason;
    for (const handler of this.closeHandlers) {
      handler(code, reason);
    }
  }

  /**
   * Simulate an error (triggers close)
   */
  simulateError(): void {
    this.readyState = MockWebSocket.CLOSING;
    this.simulateClose(1006, "Connection error");
  }

  /**
   * Send a message (stores it for assertions)
   */
  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.sentMessages.push(data);
  }

  /**
   * Close the connection (client-initiated)
   */
  close(code = 1000, reason = ""): void {
    if (
      this.readyState === MockWebSocket.CLOSED ||
      this.readyState === MockWebSocket.CLOSING
    ) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    this.simulateClose(code, reason);
  }

  /**
   * Register event handlers (mimics addEventListener)
   */
  addEventListener(
    event: "message" | "close" | "open" | "error",
    handler: unknown
  ): void {
    switch (event) {
      case "message":
        this.messageHandlers.push((data: string) =>
          (handler as (evt: { data: string }) => void)({ data })
        );
        break;
      case "close":
        this.closeHandlers.push((code, reason) =>
          (handler as (evt: { code?: number; reason?: string }) => void)({
            code,
            reason,
          })
        );
        break;
      case "open":
        this.openHandlers.push(handler as () => void);
        break;
      case "error":
        // Error handling can be added if needed
        break;
    }
  }

  // Also support direct assignment like real WebSocket
  set onmessage(handler: ((evt: { data: string }) => void) | null) {
    if (handler) {
      this.messageHandlers = [
        (data: string) => handler({ data }),
      ] as MessageHandler[];
    }
  }

  set onclose(
    handler: ((evt: { code?: number; reason?: string }) => void) | null
  ) {
    if (handler) {
      this.closeHandlers = [(code, reason) => handler({ code, reason })];
    }
  }

  set onopen(handler: (() => void) | null) {
    if (handler) {
      this.openHandlers = [handler];
    }
  }

  set onerror(_handler: ((evt: unknown) => void) | null) {
    // Error handler (can be expanded if needed)
  }

  /**
   * Get the last sent message parsed as JSON
   */
  getLastSentMessage<T = unknown>(): T | undefined {
    const last = this.sentMessages[this.sentMessages.length - 1];
    return last ? (JSON.parse(last) as T) : undefined;
  }

  /**
   * Get all sent messages parsed as JSON
   */
  getAllSentMessages<T = unknown>(): T[] {
    return this.sentMessages.map((msg) => JSON.parse(msg) as T);
  }

  /**
   * Clear sent messages (useful between test assertions)
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

/**
 * Create a mock WebSocket that's already in OPEN state
 */
export function createOpenMockWebSocket(): MockWebSocket {
  const ws = new MockWebSocket();
  ws.readyState = MockWebSocket.OPEN;
  return ws;
}

/**
 * Create a mock WebSocket that's in CLOSED state
 */
export function createClosedMockWebSocket(): MockWebSocket {
  const ws = new MockWebSocket();
  ws.readyState = MockWebSocket.CLOSED;
  return ws;
}

/**
 * Create multiple mock WebSockets for multi-connection tests
 */
export function createMockWebSocketPair(): [MockWebSocket, MockWebSocket] {
  return [createOpenMockWebSocket(), createOpenMockWebSocket()];
}
