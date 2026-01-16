import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  createOpenMockWebSocket,
  createTestChannel,
  createTestChannelMember,
  createTestUser,
  resetCounters,
} from "../../test-utils";

// Store mock implementations
let mockChannelMemberIds: Map<number, number[]> = new Map();
let mockChannelMemberships: Map<string, object> = new Map();
let mockUsers: Map<number, object> = new Map();
let mockChannels: Map<number, object> = new Map();
let mockBlocked: Set<string> = new Set();

// Mock the repository before importing the service
mock.module("./chat.repository", () => ({
  chatRepository: {
    getChannelMemberIds: mock(async (channelId: number) => {
      return mockChannelMemberIds.get(channelId) ?? [];
    }),
    getChannelMembership: mock(async (channelId: number, userId: number) => {
      const key = `${channelId}:${userId}`;
      return mockChannelMemberships.get(key) ?? null;
    }),
    getUserById: mock(async (userId: number) => {
      return mockUsers.get(userId) ?? null;
    }),
    getChannelById: mock(async (channelId: number) => {
      return mockChannels.get(channelId) ?? null;
    }),
    isBlocked: mock(async (userId: number, targetId: number) => {
      return (
        mockBlocked.has(`${userId}:${targetId}`) ||
        mockBlocked.has(`${targetId}:${userId}`)
      );
    }),
    findDMBetweenUsers: mock(async () => null),
    createChannel: mock(async (data: unknown) => {
      const channel = createTestChannel(data as Record<string, unknown>);
      mockChannels.set(channel.id, channel);
      return channel;
    }),
    addChannelMember: mock(
      async (data: { channelId: number; userId: number }) => {
        const member = createTestChannelMember(data.channelId, data.userId);
        const key = `${data.channelId}:${data.userId}`;
        mockChannelMemberships.set(key, member);
        const memberIds = mockChannelMemberIds.get(data.channelId) ?? [];
        memberIds.push(data.userId);
        mockChannelMemberIds.set(data.channelId, memberIds);
        return member;
      }
    ),
    createMessage: mock(
      async (data: {
        channelId: number;
        senderId: number;
        content: string;
      }) => ({
        id: Date.now(),
        ...data,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date(),
      })
    ),
    markAsRead: mock(async () => new Date()),
    getMessages: mock(async () => []),
  },
}));

// Mock notifications service
mock.module("../notifications/notifications.service", () => ({
  NotificationsService: {
    notifyChatMessage: mock(async () => {}),
  },
}));

// Import after mocking
import { ChatService } from "./chat.service";

describe("ChatService", () => {
  beforeEach(() => {
    resetCounters();
    mockChannelMemberIds = new Map();
    mockChannelMemberships = new Map();
    mockUsers = new Map();
    mockChannels = new Map();
    mockBlocked = new Set();
  });

  afterEach(() => {
    // Clear all connections after each test
    // We need to access internal state for cleanup - this is a test-only concern
  });

  describe("WebSocket Connection Registry", () => {
    test("registerConnection adds WebSocket to user's connection set", () => {
      const user = createTestUser();
      const ws = createOpenMockWebSocket();

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);

      // Verify by sending a message - it should be received
      const channel = createTestChannel({ createdBy: user.id });
      mockChannelMemberIds.set(channel.id, [user.id]);

      const messageSent = ws.sentMessages.length;
      ChatService.sendToUser(user.id, {
        type: "typing_update",
        channelId: channel.id,
        typingUserIds: [],
      });

      expect(ws.sentMessages.length).toBe(messageSent + 1);
    });

    test("unregisterConnection removes WebSocket from user's connection set", () => {
      const user = createTestUser();
      const ws = createOpenMockWebSocket();

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);
      ChatService.unregisterConnection(user.id, ws as unknown as WebSocket);

      // Verify by sending a message - it should NOT be received
      ws.clearSentMessages();
      ChatService.sendToUser(user.id, {
        type: "typing_update",
        channelId: 1,
        typingUserIds: [],
      });

      expect(ws.sentMessages.length).toBe(0);
    });

    test("supports multiple connections per user", () => {
      const user = createTestUser();
      const ws1 = createOpenMockWebSocket();
      const ws2 = createOpenMockWebSocket();

      ChatService.registerConnection(user.id, ws1 as unknown as WebSocket);
      ChatService.registerConnection(user.id, ws2 as unknown as WebSocket);

      // Both should receive messages
      ChatService.sendToUser(user.id, {
        type: "typing_update",
        channelId: 1,
        typingUserIds: [],
      });

      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(1);
    });

    test("unregistering one connection does not affect other connections", () => {
      const user = createTestUser();
      const ws1 = createOpenMockWebSocket();
      const ws2 = createOpenMockWebSocket();

      ChatService.registerConnection(user.id, ws1 as unknown as WebSocket);
      ChatService.registerConnection(user.id, ws2 as unknown as WebSocket);
      ChatService.unregisterConnection(user.id, ws1 as unknown as WebSocket);

      ws1.clearSentMessages();
      ws2.clearSentMessages();

      ChatService.sendToUser(user.id, {
        type: "typing_update",
        channelId: 1,
        typingUserIds: [],
      });

      expect(ws1.sentMessages.length).toBe(0);
      expect(ws2.sentMessages.length).toBe(1);
    });

    test("sendToUser skips closed WebSocket connections", () => {
      const user = createTestUser();
      const ws = createOpenMockWebSocket();
      ws.readyState = 3; // CLOSED

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);
      ChatService.sendToUser(user.id, {
        type: "typing_update",
        channelId: 1,
        typingUserIds: [],
      });

      expect(ws.sentMessages.length).toBe(0);
    });

    test("sendToUser does nothing for non-existent user", () => {
      // Should not throw
      expect(() => {
        ChatService.sendToUser(99999, {
          type: "typing_update",
          channelId: 1,
          typingUserIds: [],
        });
      }).not.toThrow();
    });
  });

  describe("Typing Indicators", () => {
    test("startTyping sets typing indicator for user in channel", async () => {
      const user = createTestUser();
      const channel = createTestChannel({ createdBy: user.id });
      const ws = createOpenMockWebSocket();

      // Set up mocks
      const membership = createTestChannelMember(channel.id, user.id);
      mockChannelMemberships.set(`${channel.id}:${user.id}`, membership);
      mockChannelMemberIds.set(channel.id, [user.id]);
      mockChannels.set(channel.id, channel);

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);
      await ChatService.startTyping(user.id, channel.id);

      // Should broadcast typing update
      const messages = ws.getAllSentMessages<{
        type: string;
        typingUserIds: number[];
      }>();
      const typingUpdate = messages.find((m) => m.type === "typing_update");

      expect(typingUpdate).toBeDefined();
      expect(typingUpdate?.typingUserIds).toContain(user.id);
    });

    test("stopTyping clears typing indicator for user", async () => {
      const user = createTestUser();
      const channel = createTestChannel({ createdBy: user.id });
      const ws = createOpenMockWebSocket();

      const membership = createTestChannelMember(channel.id, user.id);
      mockChannelMemberships.set(`${channel.id}:${user.id}`, membership);
      mockChannelMemberIds.set(channel.id, [user.id]);
      mockChannels.set(channel.id, channel);

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);

      await ChatService.startTyping(user.id, channel.id);
      ws.clearSentMessages();
      await ChatService.stopTyping(user.id, channel.id);

      const messages = ws.getAllSentMessages<{
        type: string;
        typingUserIds: number[];
      }>();
      const typingUpdate = messages.find((m) => m.type === "typing_update");

      expect(typingUpdate).toBeDefined();
      expect(typingUpdate?.typingUserIds).not.toContain(user.id);
    });

    test("startTyping does nothing if user is not a channel member", async () => {
      const user = createTestUser();
      const channel = createTestChannel();
      const ws = createOpenMockWebSocket();

      // No membership set up
      mockChannelMemberIds.set(channel.id, []);
      mockChannels.set(channel.id, channel);

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);
      await ChatService.startTyping(user.id, channel.id);

      // Should not broadcast (no membership)
      expect(ws.sentMessages.length).toBe(0);
    });

    test("unregisterConnection clears typing indicators for disconnected user", async () => {
      const user = createTestUser();
      const channel = createTestChannel({ createdBy: user.id });
      const ws = createOpenMockWebSocket();

      // Set up membership
      mockChannelMemberships.set(
        `${channel.id}:${user.id}`,
        createTestChannelMember(channel.id, user.id)
      );
      mockChannelMemberIds.set(channel.id, [user.id]);
      mockChannels.set(channel.id, channel);

      ChatService.registerConnection(user.id, ws as unknown as WebSocket);

      // Start typing
      await ChatService.startTyping(user.id, channel.id);

      // Verify user is typing (check the last message)
      let messages = ws.getAllSentMessages<{
        type: string;
        typingUserIds: number[];
      }>();
      let typingUpdate = [...messages]
        .reverse()
        .find(
          (m: { type: string; typingUserIds: number[] }) =>
            m.type === "typing_update"
        );
      expect(typingUpdate?.typingUserIds).toContain(user.id);

      // Disconnect user - this should clear typing
      ws.clearSentMessages();
      ChatService.unregisterConnection(user.id, ws as unknown as WebSocket);

      // Re-register and start typing again to verify the indicator was cleared
      const ws2 = createOpenMockWebSocket();
      ChatService.registerConnection(user.id, ws2 as unknown as WebSocket);
      await ChatService.startTyping(user.id, channel.id);

      messages = ws2.getAllSentMessages<{
        type: string;
        typingUserIds: number[];
      }>();
      typingUpdate = [...messages]
        .reverse()
        .find(
          (m: { type: string; typingUserIds: number[] }) =>
            m.type === "typing_update"
        );
      // The typing list should now only have this user (from the fresh start)
      expect(typingUpdate?.typingUserIds).toEqual([user.id]);
    });
  });

  describe("broadcastToChannel", () => {
    test("sends message to all channel members", async () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      const channel = createTestChannel({ createdBy: user1.id });
      const ws1 = createOpenMockWebSocket();
      const ws2 = createOpenMockWebSocket();

      mockChannelMemberIds.set(channel.id, [user1.id, user2.id]);

      ChatService.registerConnection(user1.id, ws1 as unknown as WebSocket);
      ChatService.registerConnection(user2.id, ws2 as unknown as WebSocket);

      await ChatService.broadcastToChannel(channel.id, {
        type: "typing_update",
        channelId: channel.id,
        typingUserIds: [],
      });

      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(1);
    });

    test("excludes specified user from broadcast", async () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      const channel = createTestChannel({ createdBy: user1.id });
      const ws1 = createOpenMockWebSocket();
      const ws2 = createOpenMockWebSocket();

      mockChannelMemberIds.set(channel.id, [user1.id, user2.id]);

      ChatService.registerConnection(user1.id, ws1 as unknown as WebSocket);
      ChatService.registerConnection(user2.id, ws2 as unknown as WebSocket);

      await ChatService.broadcastToChannel(
        channel.id,
        {
          type: "typing_update",
          channelId: channel.id,
          typingUserIds: [],
        },
        user1.id // Exclude user1
      );

      expect(ws1.sentMessages.length).toBe(0);
      expect(ws2.sentMessages.length).toBe(1);
    });
  });

  describe("createOrGetDM", () => {
    test("returns error when trying to message yourself", async () => {
      const user = createTestUser();
      mockUsers.set(user.id, user);

      const result = await ChatService.createOrGetDM(user.id, user.id);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CANNOT_MESSAGE_SELF");
      }
    });

    test("returns error when target user does not exist", async () => {
      const user = createTestUser();

      const result = await ChatService.createOrGetDM(user.id, 99999);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("USER_NOT_FOUND");
      }
    });

    test("returns error when blocked", async () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);
      mockBlocked.add(`${user1.id}:${user2.id}`);

      const result = await ChatService.createOrGetDM(user1.id, user2.id);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("USER_BLOCKED");
      }
    });
  });

  describe("sendMessage", () => {
    test("returns error for empty message", async () => {
      const user = createTestUser();

      const result = await ChatService.sendMessage(user.id, 1, "");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("EMPTY_MESSAGE");
      }
    });

    test("returns error for whitespace-only message", async () => {
      const user = createTestUser();

      const result = await ChatService.sendMessage(user.id, 1, "   \t\n  ");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("EMPTY_MESSAGE");
      }
    });

    test("returns error for message exceeding max length", async () => {
      const user = createTestUser();
      const longMessage = "a".repeat(2001);

      const result = await ChatService.sendMessage(user.id, 1, longMessage);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("MESSAGE_TOO_LONG");
      }
    });

    test("returns error when channel does not exist", async () => {
      const user = createTestUser();

      const result = await ChatService.sendMessage(user.id, 99999, "Hello");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CHANNEL_NOT_FOUND");
      }
    });

    test("returns error when user is not a member", async () => {
      const user = createTestUser();
      const channel = createTestChannel();
      mockChannels.set(channel.id, channel);

      const result = await ChatService.sendMessage(
        user.id,
        channel.id,
        "Hello"
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NOT_A_MEMBER");
      }
    });
  });

  describe("getMessages", () => {
    test("returns error when channel does not exist", async () => {
      const user = createTestUser();

      const result = await ChatService.getMessages(user.id, 99999);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CHANNEL_NOT_FOUND");
      }
    });

    test("returns error when user is not a member", async () => {
      const user = createTestUser();
      const channel = createTestChannel();
      mockChannels.set(channel.id, channel);

      const result = await ChatService.getMessages(user.id, channel.id);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NOT_A_MEMBER");
      }
    });
  });

  describe("markAsRead", () => {
    test("returns error when channel does not exist", async () => {
      const user = createTestUser();

      const result = await ChatService.markAsRead(user.id, 99999);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CHANNEL_NOT_FOUND");
      }
    });

    test("returns error when user is not a member", async () => {
      const user = createTestUser();
      const channel = createTestChannel();
      mockChannels.set(channel.id, channel);

      const result = await ChatService.markAsRead(user.id, channel.id);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NOT_A_MEMBER");
      }
    });
  });

  describe("getChannelInfo", () => {
    test("returns error when channel does not exist", async () => {
      const user = createTestUser();

      const result = await ChatService.getChannelInfo(user.id, 99999);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("CHANNEL_NOT_FOUND");
      }
    });

    test("returns error when user is not a member", async () => {
      const user = createTestUser();
      const channel = createTestChannel();
      mockChannels.set(channel.id, channel);

      const result = await ChatService.getChannelInfo(user.id, channel.id);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("NOT_A_MEMBER");
      }
    });
  });
});
