import { err, ok, ResultAsync } from "neverthrow";

import type {
  ChatError,
  ConversationItem,
  MessageItem,
  WSServerMessage,
} from "./chat.model";

import { logger } from "../../common/logger";
import { shutdownManager } from "../../common/shutdown";
import { NotificationsService } from "../notifications/notifications.service";
import { chatRepository } from "./chat.repository";

const chatLogger = logger.child().withContext({ module: "chat" });

// WebSocket connection registry: Map<userId, Set<WebSocket>>
const wsConnections = new Map<number, Set<WebSocket>>();

// Typing indicators: Map<channelId, Map<userId, timeoutId>>
const typingUsers = new Map<number, Map<number, Timer>>();

abstract class ChatService {
  private static readonly TYPING_TIMEOUT_MS = 3000;

  /**
   * Register a WebSocket connection for a user
   */
  static registerConnection(userId: number, ws: WebSocket) {
    if (!wsConnections.has(userId)) {
      wsConnections.set(userId, new Set());
    }
    wsConnections.get(userId)?.add(ws);
  }

  /**
   * Unregister a WebSocket connection for a user
   */
  static unregisterConnection(userId: number, ws: WebSocket) {
    const userConnections = wsConnections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        wsConnections.delete(userId);
      }
    }

    // Clear any typing indicators for this user
    for (const [channelId, typingMap] of typingUsers.entries()) {
      if (typingMap.has(userId)) {
        clearTimeout(typingMap.get(userId));
        typingMap.delete(userId);
        ChatService.broadcastTypingUpdate(channelId);
      }
    }
  }

  /**
   * Send a message to all connections of a user
   */
  static sendToUser(userId: number, message: WSServerMessage) {
    const userConnections = wsConnections.get(userId);
    if (userConnections) {
      const messageStr = JSON.stringify(message);
      for (const ws of userConnections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      }
    }
  }

  /**
   * Broadcast a message to all members of a channel
   */
  static async broadcastToChannel(
    channelId: number,
    message: WSServerMessage,
    excludeUserId?: number
  ) {
    const memberIds = await chatRepository.getChannelMemberIds(channelId);

    for (const memberId of memberIds) {
      if (memberId !== excludeUserId) {
        ChatService.sendToUser(memberId, message);
      }
    }
  }

  /**
   * Broadcast typing update to channel members
   */
  static async broadcastTypingUpdate(channelId: number) {
    const channelTyping = typingUsers.get(channelId);
    const typingUserIds = channelTyping ? Array.from(channelTyping.keys()) : [];

    await ChatService.broadcastToChannel(channelId, {
      type: "typing_update",
      channelId,
      typingUserIds,
    });
  }

  /**
   * Create or get an existing DM channel between two users
   */
  static createOrGetDM(
    userId: number,
    targetUserId: number
  ): ResultAsync<{ channelId: number; isNew: boolean }, ChatError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Can't message yourself
        if (userId === targetUserId) {
          return err({ type: "CANNOT_MESSAGE_SELF" as const });
        }

        // Check if target user exists
        const targetUser = await chatRepository.getUserById(targetUserId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Check if either user has blocked the other
        const blocked = await chatRepository.isBlocked(userId, targetUserId);
        if (blocked) {
          return err({ type: "USER_BLOCKED" as const });
        }

        // Check for existing DM
        const existingDM = await chatRepository.findDMBetweenUsers(
          userId,
          targetUserId
        );
        if (existingDM) {
          return ok({ channelId: existingDM.id, isNew: false });
        }

        // Create new DM channel
        const channel = await chatRepository.createChannel({
          type: "dm",
          createdBy: userId,
        });

        // Add both users as members
        await chatRepository.addChannelMember({
          channelId: channel.id,
          userId,
          role: "member",
        });
        await chatRepository.addChannelMember({
          channelId: channel.id,
          userId: targetUserId,
          role: "member",
        });

        return ok({ channelId: channel.id, isNew: true });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get all conversations for a user
   */
  static getConversations(
    userId: number
  ): ResultAsync<ConversationItem[], never> {
    return ResultAsync.fromPromise(
      chatRepository.getUserConversations(userId),
      (): never => {
        throw new Error("Unexpected error fetching conversations");
      }
    );
  }

  /**
   * Send a message to a channel
   */
  static sendMessage(
    userId: number,
    channelId: number,
    content: string
  ): ResultAsync<MessageItem, ChatError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Validate content
        if (!content.trim()) {
          return err({ type: "EMPTY_MESSAGE" as const });
        }
        if (content.length > 2000) {
          return err({ type: "MESSAGE_TOO_LONG" as const });
        }

        // Check channel exists
        const channel = await chatRepository.getChannelById(channelId);
        if (!channel) {
          return err({ type: "CHANNEL_NOT_FOUND" as const });
        }

        // Check user is a member
        const membership = await chatRepository.getChannelMembership(
          channelId,
          userId
        );
        if (!membership) {
          return err({ type: "NOT_A_MEMBER" as const });
        }

        // For DMs, check if blocked
        if (channel.type === "dm") {
          const memberIds = await chatRepository.getChannelMemberIds(channelId);
          const otherUserId = memberIds.find((id) => id !== userId);
          if (otherUserId) {
            const blocked = await chatRepository.isBlocked(userId, otherUserId);
            if (blocked) {
              return err({ type: "USER_BLOCKED" as const });
            }
          }
        }

        // Create message
        const message = await chatRepository.createMessage({
          channelId,
          senderId: userId,
          content: content.trim(),
        });

        // Get sender info
        const sender = await chatRepository.getUserById(userId);

        const messageItem: MessageItem = {
          id: message.id,
          channelId: message.channelId,
          content: message.content,
          sender: {
            id: sender?.id ?? userId,
            displayName: sender?.displayName ?? "Unknown",
            avatarUrl: sender?.avatarUrl ?? null,
          },
          editedAt: message.editedAt,
          createdAt: message.createdAt,
        };

        // Clear typing indicator for this user
        ChatService.stopTyping(userId, channelId);

        // Broadcast to other channel members via WebSocket
        await ChatService.broadcastToChannel(
          channelId,
          {
            type: "new_message",
            data: {
              id: messageItem.id,
              channelId: messageItem.channelId,
              content: messageItem.content,
              sender: messageItem.sender,
              createdAt: messageItem.createdAt.toISOString(),
            },
          },
          userId
        );

        // Send notifications to other channel members
        const memberIds = await chatRepository.getChannelMemberIds(channelId);
        for (const memberId of memberIds) {
          if (memberId !== userId) {
            // Only notify users not currently connected to chat WebSocket
            const isConnected = wsConnections.has(memberId);
            if (!isConnected) {
              await NotificationsService.notifyChatMessage(
                memberId,
                channelId,
                messageItem.sender.displayName,
                messageItem.content
              );
            }
          }
        }

        return ok(messageItem);
      })(),
      () => ({ type: "CHANNEL_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get messages for a channel
   */
  static getMessages(
    userId: number,
    channelId: number,
    options: { limit?: number; before?: number } = {}
  ): ResultAsync<MessageItem[], ChatError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Check channel exists
        const channel = await chatRepository.getChannelById(channelId);
        if (!channel) {
          return err({ type: "CHANNEL_NOT_FOUND" as const });
        }

        // Check user is a member
        const membership = await chatRepository.getChannelMembership(
          channelId,
          userId
        );
        if (!membership) {
          return err({ type: "NOT_A_MEMBER" as const });
        }

        const messages = await chatRepository.getMessages(channelId, options);

        const messageItems: MessageItem[] = messages.map((msg) => ({
          id: msg.id,
          channelId: msg.channelId,
          content: msg.content,
          sender: {
            id: msg.sender.id,
            displayName: msg.sender.displayName,
            avatarUrl: msg.sender.avatarUrl,
          },
          editedAt: msg.editedAt,
          createdAt: msg.createdAt,
        }));

        return ok(messageItems);
      })(),
      () => ({ type: "CHANNEL_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Mark a channel as read for a user
   */
  static markAsRead(
    userId: number,
    channelId: number
  ): ResultAsync<{ readAt: Date }, ChatError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Check channel exists
        const channel = await chatRepository.getChannelById(channelId);
        if (!channel) {
          return err({ type: "CHANNEL_NOT_FOUND" as const });
        }

        // Check user is a member
        const membership = await chatRepository.getChannelMembership(
          channelId,
          userId
        );
        if (!membership) {
          return err({ type: "NOT_A_MEMBER" as const });
        }

        const readAt = await chatRepository.markAsRead(channelId, userId);

        // Broadcast read receipt to other members
        await ChatService.broadcastToChannel(
          channelId,
          {
            type: "read_receipt",
            channelId,
            userId,
            readAt: readAt.toISOString(),
          },
          userId
        );

        return ok({ readAt });
      })(),
      () => ({ type: "CHANNEL_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Start typing indicator for a user in a channel
   */
  static async startTyping(userId: number, channelId: number) {
    // Check membership first
    const membership = await chatRepository.getChannelMembership(
      channelId,
      userId
    );
    if (!membership) {
      return;
    }

    // Clear existing timeout if any
    const channelTyping = typingUsers.get(channelId);
    if (channelTyping?.has(userId)) {
      clearTimeout(channelTyping.get(userId));
    }

    // Set up new typing indicator
    if (!typingUsers.has(channelId)) {
      typingUsers.set(channelId, new Map());
    }

    const timeout = setTimeout(() => {
      ChatService.stopTyping(userId, channelId);
    }, ChatService.TYPING_TIMEOUT_MS);

    typingUsers.get(channelId)?.set(userId, timeout);

    // Broadcast update
    await ChatService.broadcastTypingUpdate(channelId);
  }

  /**
   * Stop typing indicator for a user in a channel
   */
  static async stopTyping(userId: number, channelId: number) {
    const channelTyping = typingUsers.get(channelId);
    if (channelTyping?.has(userId)) {
      clearTimeout(channelTyping.get(userId));
      channelTyping.delete(userId);

      // Broadcast update
      await ChatService.broadcastTypingUpdate(channelId);
    }
  }

  /**
   * Get channel info for a user (with access check)
   */
  static getChannelInfo(
    userId: number,
    channelId: number
  ): ResultAsync<
    {
      channelId: number;
      type: "dm" | "public" | "private";
      name: string | null;
      participant?: {
        id: number;
        displayName: string;
        avatarUrl: string | null;
      };
    },
    ChatError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const channel = await chatRepository.getChannelById(channelId);
        if (!channel) {
          return err({ type: "CHANNEL_NOT_FOUND" as const });
        }

        const membership = await chatRepository.getChannelMembership(
          channelId,
          userId
        );
        if (!membership) {
          return err({ type: "NOT_A_MEMBER" as const });
        }

        let participant = undefined;
        if (channel.type === "dm") {
          const memberIds = await chatRepository.getChannelMemberIds(channelId);
          const otherUserId = memberIds.find((id) => id !== userId);
          if (otherUserId) {
            const otherUser = await chatRepository.getUserById(otherUserId);
            if (otherUser) {
              participant = {
                id: otherUser.id,
                displayName: otherUser.displayName,
                avatarUrl: otherUser.avatarUrl,
              };
            }
          }
        }

        return ok({
          channelId: channel.id,
          type: channel.type as "dm" | "public" | "private",
          name: channel.name,
          participant,
        });
      })(),
      () => ({ type: "CHANNEL_NOT_FOUND" as const })
    ).andThen((result) => result);
  }
}

// Register WebSocket shutdown handler
shutdownManager.register(
  "websocket-connections",
  async () => {
    const totalConnections = [...wsConnections.values()].reduce(
      (sum, set) => sum + set.size,
      0
    );

    chatLogger
      .withMetadata({
        action: "draining_connections",
        connectionCount: totalConnections,
        userCount: wsConnections.size,
      })
      .info("Draining WebSocket connections");

    // Send shutdown message to all connected clients
    const shutdownMessage = JSON.stringify({
      type: "server_shutdown",
      message: "Server is shutting down",
    });

    for (const [_userId, connections] of wsConnections) {
      for (const ws of connections) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(shutdownMessage);
            ws.close(1001, "Server shutdown"); // 1001 = Going Away
          }
        } catch {
          // Ignore errors during shutdown
        }
      }
      connections.clear();
    }

    wsConnections.clear();

    // Clear all typing indicator timeouts
    for (const [, typingMap] of typingUsers) {
      for (const [, timeout] of typingMap) {
        clearTimeout(timeout);
      }
      typingMap.clear();
    }
    typingUsers.clear();

    chatLogger
      .withMetadata({ action: "connections_drained" })
      .info("WebSocket connections drained");
  },
  3000
);

export { ChatService };
