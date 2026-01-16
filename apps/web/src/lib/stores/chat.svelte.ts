import { chatKeys } from "$lib/queries/chat";
import { useQueryClient } from "@tanstack/svelte-query";

export type WSServerMessage =
  | {
      type: "new_message";
      data: {
        id: number;
        channelId: number;
        content: string;
        sender: { id: number; displayName: string; avatarUrl: string | null };
        createdAt: string;
      };
    }
  | {
      type: "message_sent";
      data: {
        id: number;
        channelId: number;
        content: string;
        sender: { id: number; displayName: string; avatarUrl: string | null };
        createdAt: string;
      };
    }
  | {
      type: "typing_update";
      channelId: number;
      typingUserIds: number[];
    }
  | {
      type: "read_receipt";
      channelId: number;
      userId: number;
      readAt: string;
    }
  | {
      type: "error";
      error: string;
    };

export type WSClientMessage =
  | { type: "send_message"; channelId: number; content: string }
  | { type: "typing_start"; channelId: number }
  | { type: "typing_stop"; channelId: number }
  | { type: "mark_read"; channelId: number };

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type MessageHandler = (message: WSServerMessage) => void;

/**
 * Get session ID from cookies
 */
function getSessionId(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "session") {
      return value;
    }
  }
  return null;
}

/**
 * Get WebSocket URL
 */
function getWsUrl(sessionId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.DEV ? "localhost:3000" : window.location.host;
  return `${protocol}//${host}/api/chat/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * Create a chat WebSocket store using Svelte 5 runes
 */
export function createChatStore() {
  let ws: WebSocket | null = $state(null);
  let connectionState: ConnectionState = $state("disconnected");
  let typingByChannel: Map<number, number[]> = $state(new Map());
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  const maxReconnectAttempts = 5;
  const messageHandlers: Set<MessageHandler> = new Set();

  // Use query client for cache invalidation
  let queryClient: ReturnType<typeof useQueryClient> | null = null;

  function setQueryClient(client: ReturnType<typeof useQueryClient>) {
    queryClient = client;
  }

  function connect() {
    if (connectionState === "connecting" || connectionState === "connected") {
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      connectionState = "error";
      return;
    }

    connectionState = "connecting";
    const url = getWsUrl(sessionId);

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        connectionState = "connected";
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSServerMessage;
          handleMessage(message);
        } catch {
          console.error("Failed to parse WebSocket message");
        }
      };

      ws.onerror = () => {
        connectionState = "error";
      };

      ws.onclose = () => {
        ws = null;
        connectionState = "disconnected";
        attemptReconnect();
      };
    } catch {
      connectionState = "error";
      attemptReconnect();
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    reconnectAttempts = maxReconnectAttempts; // Prevent reconnection

    if (ws) {
      ws.close();
      ws = null;
    }
    connectionState = "disconnected";
  }

  function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      connect();
    }, delay);
  }

  function handleMessage(message: WSServerMessage) {
    // Notify all handlers
    for (const handler of messageHandlers) {
      handler(message);
    }

    switch (message.type) {
      case "new_message":
      case "message_sent": {
        // Invalidate queries to refresh data
        if (queryClient) {
          queryClient.invalidateQueries({
            queryKey: chatKeys.messages(message.data.channelId),
          });
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(),
          });
        }
        break;
      }

      case "typing_update": {
        typingByChannel.set(message.channelId, message.typingUserIds);
        // Force reactivity
        typingByChannel = new Map(typingByChannel);
        break;
      }

      case "read_receipt": {
        // Invalidate conversations to update unread counts
        if (queryClient) {
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(),
          });
        }
        break;
      }

      case "error": {
        console.error("WebSocket error:", message.error);
        break;
      }
    }
  }

  function send(message: WSClientMessage) {
    if (ws && connectionState === "connected") {
      ws.send(JSON.stringify(message));
    }
  }

  function sendMessage(channelId: number, content: string) {
    send({ type: "send_message", channelId, content });
  }

  function startTyping(channelId: number) {
    send({ type: "typing_start", channelId });
  }

  function stopTyping(channelId: number) {
    send({ type: "typing_stop", channelId });
  }

  function markRead(channelId: number) {
    send({ type: "mark_read", channelId });
  }

  function onMessage(handler: MessageHandler) {
    messageHandlers.add(handler);
    return () => {
      messageHandlers.delete(handler);
    };
  }

  function getTypingUsers(channelId: number): number[] {
    return typingByChannel.get(channelId) ?? [];
  }

  return {
    get connectionState() {
      return connectionState;
    },
    get isConnected() {
      return connectionState === "connected";
    },
    setQueryClient,
    connect,
    disconnect,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    onMessage,
    getTypingUsers,
  };
}

// Singleton instance for the chat store
let chatStoreInstance: ReturnType<typeof createChatStore> | null = null;

export function getChatStore() {
  if (!chatStoreInstance) {
    chatStoreInstance = createChatStore();
  }
  return chatStoreInstance;
}
