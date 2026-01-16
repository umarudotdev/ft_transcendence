import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  type ChannelRole,
  type ChannelType,
  channelMembers,
  channels,
  friends,
  messages,
  users,
} from "../../db/schema";

export const chatRepository = {
  /**
   * Create a new channel
   */
  async createChannel(data: {
    name?: string | null;
    type: ChannelType;
    createdBy: number;
  }) {
    const [channel] = await db
      .insert(channels)
      .values({
        name: data.name,
        type: data.type,
        createdBy: data.createdBy,
      })
      .returning();

    return channel;
  },

  /**
   * Add a member to a channel
   */
  async addChannelMember(data: {
    channelId: number;
    userId: number;
    role?: ChannelRole;
  }) {
    const [member] = await db
      .insert(channelMembers)
      .values({
        channelId: data.channelId,
        userId: data.userId,
        role: data.role ?? "member",
      })
      .returning();

    return member;
  },

  /**
   * Find an existing DM channel between two users
   */
  async findDMBetweenUsers(userId1: number, userId2: number) {
    const result = await db
      .select({
        channelId: channels.id,
      })
      .from(channels)
      .innerJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(
        and(
          eq(channels.type, "dm"),
          or(
            eq(channelMembers.userId, userId1),
            eq(channelMembers.userId, userId2)
          )
        )
      )
      .groupBy(channels.id)
      .having(sql`COUNT(DISTINCT ${channelMembers.userId}) = 2`);

    if (result.length === 0) {
      return null;
    }

    // Verify both users are members of this channel
    for (const row of result) {
      const members = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, row.channelId));

      const memberIds = members.map((m) => m.userId);
      if (memberIds.includes(userId1) && memberIds.includes(userId2)) {
        return db.query.channels.findFirst({
          where: eq(channels.id, row.channelId),
        });
      }
    }

    return null;
  },

  /**
   * Get a channel by ID
   */
  async getChannelById(channelId: number) {
    return db.query.channels.findFirst({
      where: eq(channels.id, channelId),
    });
  },

  /**
   * Get a user's membership in a channel
   */
  async getChannelMembership(channelId: number, userId: number) {
    return db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, userId)
      ),
    });
  },

  /**
   * Get all conversations for a user with last message and unread count
   */
  async getUserConversations(userId: number) {
    // Get all channels the user is a member of
    const memberChannels = await db.query.channelMembers.findMany({
      where: eq(channelMembers.userId, userId),
      with: {
        channel: {
          with: {
            members: {
              with: {
                user: {
                  columns: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const conversations = [];

    for (const membership of memberChannels) {
      const channel = membership.channel;

      // Get last message for this channel
      const lastMessage = await db.query.messages.findFirst({
        where: and(
          eq(messages.channelId, channel.id),
          isNull(messages.deletedAt)
        ),
        orderBy: [desc(messages.createdAt)],
        with: {
          sender: {
            columns: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      // Count unread messages
      const unreadConditions = [
        eq(messages.channelId, channel.id),
        isNull(messages.deletedAt),
      ];

      if (membership.lastReadAt) {
        unreadConditions.push(gt(messages.createdAt, membership.lastReadAt));
      }

      const [unreadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(...unreadConditions));

      const unreadCount = unreadResult?.count ?? 0;

      // For DMs, get the other participant
      let participant:
        | { id: number; displayName: string; avatarUrl: string | null }
        | undefined;
      if (channel.type === "dm") {
        const otherMember = channel.members.find((m) => m.userId !== userId);
        if (otherMember) {
          participant = otherMember.user;
        }
      }

      conversations.push({
        channelId: channel.id,
        type: channel.type as "dm" | "public" | "private",
        name: channel.name,
        participant,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.displayName,
              createdAt: lastMessage.createdAt,
            }
          : undefined,
        unreadCount: Number(unreadCount),
        updatedAt: lastMessage?.createdAt ?? channel.createdAt,
      });
    }

    // Sort by most recent activity
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return conversations;
  },

  /**
   * Create a new message
   */
  async createMessage(data: {
    channelId: number;
    senderId: number;
    content: string;
  }) {
    const [message] = await db
      .insert(messages)
      .values({
        channelId: data.channelId,
        senderId: data.senderId,
        content: data.content,
      })
      .returning();

    // Update channel's updatedAt
    await db
      .update(channels)
      .set({ updatedAt: new Date() })
      .where(eq(channels.id, data.channelId));

    return message;
  },

  /**
   * Get messages for a channel with pagination
   */
  async getMessages(
    channelId: number,
    options: { limit?: number; before?: number } = {}
  ) {
    const { limit = 50, before } = options;

    const conditions = [
      eq(messages.channelId, channelId),
      isNull(messages.deletedAt),
    ];

    if (before) {
      conditions.push(lt(messages.id, before));
    }

    const messageList = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [desc(messages.createdAt)],
      limit: Math.min(limit, 100),
      with: {
        sender: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Return in chronological order
    return messageList.reverse();
  },

  /**
   * Get the last message in a channel
   */
  async getLastMessage(channelId: number) {
    return db.query.messages.findFirst({
      where: and(eq(messages.channelId, channelId), isNull(messages.deletedAt)),
      orderBy: [desc(messages.createdAt)],
      with: {
        sender: {
          columns: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  },

  /**
   * Get unread message count for a user in a channel
   */
  async getUnreadCount(channelId: number, userId: number) {
    const membership = await this.getChannelMembership(channelId, userId);

    if (!membership) {
      return 0;
    }

    const conditions = [
      eq(messages.channelId, channelId),
      isNull(messages.deletedAt),
    ];

    if (membership.lastReadAt) {
      conditions.push(gt(messages.createdAt, membership.lastReadAt));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(...conditions));

    return Number(result?.count ?? 0);
  },

  /**
   * Mark messages as read up to a certain point
   */
  async markAsRead(channelId: number, userId: number) {
    const now = new Date();

    await db
      .update(channelMembers)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      );

    return now;
  },

  /**
   * Get all member IDs for a channel
   */
  async getChannelMemberIds(channelId: number) {
    const members = await db
      .select({ userId: channelMembers.userId })
      .from(channelMembers)
      .where(eq(channelMembers.channelId, channelId));

    return members.map((m) => m.userId);
  },

  /**
   * Check if one user has blocked another
   */
  async isBlocked(userId: number, targetId: number) {
    const blocked = await db.query.friends.findFirst({
      where: and(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, targetId)),
          and(eq(friends.userId, targetId), eq(friends.friendId, userId))
        ),
        eq(friends.status, "blocked")
      ),
    });

    return !!blocked;
  },

  /**
   * Get a user by ID
   */
  async getUserById(userId: number) {
    return db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  },

  /**
   * Get a message by ID with sender info
   */
  async getMessageById(messageId: number) {
    return db.query.messages.findFirst({
      where: eq(messages.id, messageId),
      with: {
        sender: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  },
};
