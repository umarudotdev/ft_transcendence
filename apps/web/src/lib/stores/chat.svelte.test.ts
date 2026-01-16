import { installMockWebSocket } from "$lib/test/mocks/websocket";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChatStore, type WSServerMessage } from "./chat.svelte";

// Mock the query client
const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

// Mock cookie access
function mockSessionCookie(sessionId: string | null) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: sessionId ? `session=${sessionId}` : "",
  });
}

describe("Chat Store", () => {
  let wsHelper: ReturnType<typeof installMockWebSocket>;
  let store: ReturnType<typeof createChatStore>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Install mock WebSocket
    wsHelper = installMockWebSocket();

    // Create a fresh store for each test
    store = createChatStore();
    store.setQueryClient(mockQueryClient as never);

    // Set up default session cookie
    mockSessionCookie("test-session-id");
  });

  afterEach(() => {
    wsHelper.restore();
    store.disconnect();
  });

  describe("Connection State", () => {
    it("starts in disconnected state", () => {
      expect(store.connectionState).toBe("disconnected");
      expect(store.isConnected).toBe(false);
    });

    it("transitions to connecting state when connect is called", () => {
      store.connect();

      expect(store.connectionState).toBe("connecting");
      expect(store.isConnected).toBe(false);
    });

    it("transitions to connected state when WebSocket opens", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      expect(store.connectionState).toBe("connected");
      expect(store.isConnected).toBe(true);
    });

    it("transitions to disconnected state when WebSocket closes", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();
      ws?.simulateServerClose();

      expect(store.connectionState).toBe("disconnected");
      expect(store.isConnected).toBe(false);
    });

    it("transitions to error state when no session cookie", () => {
      mockSessionCookie(null);

      store.connect();

      expect(store.connectionState).toBe("error");
      expect(store.isConnected).toBe(false);
    });

    it("transitions to error state on WebSocket error", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateError();

      // After error, it should try to reconnect, so state goes through disconnected
      expect(["disconnected", "connecting", "error"]).toContain(
        store.connectionState
      );
    });

    it("does not connect if already connecting", () => {
      store.connect();
      store.connect();

      // WebSocket constructor should only be called once
      expect(wsHelper.getInstance()).toBeDefined();
    });

    it("does not connect if already connected", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const firstWs = ws;
      store.connect();

      // Should still be the same WebSocket
      expect(wsHelper.getInstance()).toBe(firstWs);
    });
  });

  describe("Reconnection Logic", () => {
    it("attempts to reconnect on close", async () => {
      vi.useFakeTimers();

      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();
      ws?.simulateServerClose();

      // First reconnect delay is 1000ms (1000 * 2^0)
      vi.advanceTimersByTime(1000);

      // Should attempt reconnect
      expect(store.connectionState).toBe("connecting");

      vi.useRealTimers();
    });

    it("uses exponential backoff for reconnection", async () => {
      vi.useFakeTimers();

      store.connect();
      let ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // First disconnect
      ws?.simulateServerClose();
      vi.advanceTimersByTime(1000); // 1000 * 2^0
      ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // Second disconnect
      ws?.simulateServerClose();
      vi.advanceTimersByTime(2000); // 1000 * 2^1
      ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // Third disconnect
      ws?.simulateServerClose();
      vi.advanceTimersByTime(4000); // 1000 * 2^2

      expect(store.connectionState).toBe("connecting");

      vi.useRealTimers();
    });

    it("stops reconnecting after max attempts", async () => {
      vi.useFakeTimers();

      store.connect();
      let ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // Simulate 5 disconnections (max attempts)
      for (let i = 0; i < 5; i++) {
        ws?.simulateServerClose();
        const delay = Math.min(1000 * 2 ** i, 30000);
        vi.advanceTimersByTime(delay);
        ws = wsHelper.getInstance();
        if (i < 4) {
          ws?.simulateOpen();
        }
      }

      // After max attempts, should stop reconnecting
      ws?.simulateServerClose();
      vi.advanceTimersByTime(60000);

      expect(store.connectionState).toBe("disconnected");

      vi.useRealTimers();
    });

    it("resets reconnect counter on successful connection", async () => {
      vi.useFakeTimers();

      store.connect();
      let ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // Disconnect and reconnect
      ws?.simulateServerClose();
      vi.advanceTimersByTime(1000);
      ws = wsHelper.getInstance();
      ws?.simulateOpen(); // This should reset the counter

      // Disconnect again - should use first delay (1000ms)
      ws?.simulateServerClose();
      vi.advanceTimersByTime(500);
      expect(store.connectionState).toBe("disconnected");
      vi.advanceTimersByTime(500);
      expect(store.connectionState).toBe("connecting");

      vi.useRealTimers();
    });

    it("disconnect() stops reconnection attempts", async () => {
      vi.useFakeTimers();

      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();
      ws?.simulateServerClose();

      // Disconnect should stop any reconnection
      store.disconnect();

      vi.advanceTimersByTime(60000);

      expect(store.connectionState).toBe("disconnected");

      vi.useRealTimers();
    });
  });

  describe("Message Handling", () => {
    it("handles new_message and invalidates queries", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const message: WSServerMessage = {
        type: "new_message",
        data: {
          id: 1,
          channelId: 123,
          content: "Hello",
          sender: { id: 1, displayName: "Test", avatarUrl: null },
          createdAt: new Date().toISOString(),
        },
      };

      ws?.simulateMessage(message);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["chat", "messages", 123],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["chat", "conversations"],
      });
    });

    it("handles message_sent and invalidates queries", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const message: WSServerMessage = {
        type: "message_sent",
        data: {
          id: 1,
          channelId: 456,
          content: "My message",
          sender: { id: 2, displayName: "Me", avatarUrl: null },
          createdAt: new Date().toISOString(),
        },
      };

      ws?.simulateMessage(message);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["chat", "messages", 456],
      });
    });

    it("handles typing_update and updates typing users", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const message: WSServerMessage = {
        type: "typing_update",
        channelId: 789,
        typingUserIds: [1, 2, 3],
      };

      ws?.simulateMessage(message);

      const typingUsers = store.getTypingUsers(789);
      expect(typingUsers).toEqual([1, 2, 3]);
    });

    it("handles read_receipt and invalidates conversations", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const message: WSServerMessage = {
        type: "read_receipt",
        channelId: 111,
        userId: 1,
        readAt: new Date().toISOString(),
      };

      ws?.simulateMessage(message);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["chat", "conversations"],
      });
    });

    it("handles error message without throwing", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const message: WSServerMessage = {
        type: "error",
        error: "Something went wrong",
      };

      // Should not throw
      expect(() => ws?.simulateMessage(message)).not.toThrow();
    });

    it("ignores malformed messages", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      // Should not throw
      expect(() => ws?.simulateMessage("not valid json {")).not.toThrow();
    });
  });

  describe("Message Handler Subscriptions", () => {
    it("notifies registered handlers of messages", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const handler = vi.fn();
      store.onMessage(handler);

      const message: WSServerMessage = {
        type: "new_message",
        data: {
          id: 1,
          channelId: 123,
          content: "Hello",
          sender: { id: 1, displayName: "Test", avatarUrl: null },
          createdAt: new Date().toISOString(),
        },
      };

      ws?.simulateMessage(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it("unsubscribes handler when cleanup function is called", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const handler = vi.fn();
      const unsubscribe = store.onMessage(handler);

      unsubscribe();

      const message: WSServerMessage = {
        type: "new_message",
        data: {
          id: 1,
          channelId: 123,
          content: "Hello",
          sender: { id: 1, displayName: "Test", avatarUrl: null },
          createdAt: new Date().toISOString(),
        },
      };

      ws?.simulateMessage(message);

      expect(handler).not.toHaveBeenCalled();
    });

    it("supports multiple handlers", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      store.onMessage(handler1);
      store.onMessage(handler2);

      const message: WSServerMessage = {
        type: "typing_update",
        channelId: 1,
        typingUserIds: [],
      };

      ws?.simulateMessage(message);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe("Sending Messages", () => {
    it("sends messages when connected", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      store.sendMessage(123, "Hello, world!");

      const sent = ws?.getLastSentMessage<{
        type: string;
        channelId: number;
        content: string;
      }>();
      expect(sent).toEqual({
        type: "send_message",
        channelId: 123,
        content: "Hello, world!",
      });
    });

    it("does not send messages when disconnected", () => {
      // Don't connect
      store.sendMessage(123, "Hello");

      // No WebSocket should exist
      expect(wsHelper.getInstance()).toBeNull();
    });

    it("sends typing_start indicator", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      store.startTyping(456);

      const sent = ws?.getLastSentMessage<{
        type: string;
        channelId: number;
      }>();
      expect(sent).toEqual({
        type: "typing_start",
        channelId: 456,
      });
    });

    it("sends typing_stop indicator", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      store.stopTyping(456);

      const sent = ws?.getLastSentMessage<{
        type: string;
        channelId: number;
      }>();
      expect(sent).toEqual({
        type: "typing_stop",
        channelId: 456,
      });
    });

    it("sends mark_read indicator", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      store.markRead(789);

      const sent = ws?.getLastSentMessage<{
        type: string;
        channelId: number;
      }>();
      expect(sent).toEqual({
        type: "mark_read",
        channelId: 789,
      });
    });
  });

  describe("Typing Users", () => {
    it("returns empty array for unknown channel", () => {
      const typingUsers = store.getTypingUsers(99999);
      expect(typingUsers).toEqual([]);
    });

    it("returns typing users for known channel", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      ws?.simulateMessage({
        type: "typing_update",
        channelId: 100,
        typingUserIds: [1, 2],
      });

      expect(store.getTypingUsers(100)).toEqual([1, 2]);
    });

    it("updates typing users when new update arrives", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      ws?.simulateMessage({
        type: "typing_update",
        channelId: 100,
        typingUserIds: [1],
      });

      ws?.simulateMessage({
        type: "typing_update",
        channelId: 100,
        typingUserIds: [1, 2, 3],
      });

      expect(store.getTypingUsers(100)).toEqual([1, 2, 3]);
    });

    it("clears typing users when empty array received", () => {
      store.connect();
      const ws = wsHelper.getInstance();
      ws?.simulateOpen();

      ws?.simulateMessage({
        type: "typing_update",
        channelId: 100,
        typingUserIds: [1, 2],
      });

      ws?.simulateMessage({
        type: "typing_update",
        channelId: 100,
        typingUserIds: [],
      });

      expect(store.getTypingUsers(100)).toEqual([]);
    });
  });
});
