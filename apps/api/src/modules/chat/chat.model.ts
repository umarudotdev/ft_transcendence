import { t } from "elysia";

import { badRequest, forbidden, notFound } from "../../common/errors";

export const ChatModel = {
  // Request schemas
  channelIdParam: t.Object({
    channelId: t.Numeric(),
  }),

  createDMBody: t.Object({
    userId: t.Number({ minimum: 1 }),
  }),

  sendMessageBody: t.Object({
    content: t.String({ minLength: 1, maxLength: 2000 }),
  }),

  messagesQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 50 })),
    before: t.Optional(t.Numeric()),
  }),

  // Response schemas
  conversationItem: t.Object({
    channelId: t.Number(),
    type: t.Union([t.Literal("dm"), t.Literal("public"), t.Literal("private")]),
    name: t.Nullable(t.String()),
    participant: t.Optional(
      t.Object({
        id: t.Number(),
        displayName: t.String(),
        avatarUrl: t.Nullable(t.String()),
      })
    ),
    lastMessage: t.Optional(
      t.Object({
        id: t.Number(),
        content: t.String(),
        senderId: t.Number(),
        senderName: t.String(),
        createdAt: t.Date(),
      })
    ),
    unreadCount: t.Number(),
    updatedAt: t.Date(),
  }),

  messageItem: t.Object({
    id: t.Number(),
    channelId: t.Number(),
    content: t.String(),
    sender: t.Object({
      id: t.Number(),
      displayName: t.String(),
      avatarUrl: t.Nullable(t.String()),
    }),
    editedAt: t.Nullable(t.Date()),
    createdAt: t.Date(),
  }),

  // WebSocket message types
  wsClientMessage: t.Union([
    t.Object({
      type: t.Literal("send_message"),
      channelId: t.Number(),
      content: t.String({ minLength: 1, maxLength: 2000 }),
    }),
    t.Object({
      type: t.Literal("typing_start"),
      channelId: t.Number(),
    }),
    t.Object({
      type: t.Literal("typing_stop"),
      channelId: t.Number(),
    }),
    t.Object({
      type: t.Literal("mark_read"),
      channelId: t.Number(),
    }),
  ]),

  wsServerMessage: t.Union([
    t.Object({
      type: t.Literal("new_message"),
      data: t.Object({
        id: t.Number(),
        channelId: t.Number(),
        content: t.String(),
        sender: t.Object({
          id: t.Number(),
          displayName: t.String(),
          avatarUrl: t.Nullable(t.String()),
        }),
        createdAt: t.String(),
      }),
    }),
    t.Object({
      type: t.Literal("message_sent"),
      data: t.Object({
        id: t.Number(),
        channelId: t.Number(),
        content: t.String(),
        sender: t.Object({
          id: t.Number(),
          displayName: t.String(),
          avatarUrl: t.Nullable(t.String()),
        }),
        createdAt: t.String(),
      }),
    }),
    t.Object({
      type: t.Literal("typing_update"),
      channelId: t.Number(),
      typingUserIds: t.Array(t.Number()),
    }),
    t.Object({
      type: t.Literal("read_receipt"),
      channelId: t.Number(),
      userId: t.Number(),
      readAt: t.String(),
    }),
    t.Object({
      type: t.Literal("error"),
      error: t.String(),
    }),
  ]),

  // Error types
  chatError: t.Union([
    t.Object({ type: t.Literal("CHANNEL_NOT_FOUND") }),
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({ type: t.Literal("NOT_A_MEMBER") }),
    t.Object({ type: t.Literal("CANNOT_MESSAGE_SELF") }),
    t.Object({ type: t.Literal("USER_BLOCKED") }),
    t.Object({ type: t.Literal("MESSAGE_TOO_LONG") }),
    t.Object({ type: t.Literal("EMPTY_MESSAGE") }),
  ]),
};

export type ChannelIdParam = (typeof ChatModel.channelIdParam)["static"];
export type CreateDMBody = (typeof ChatModel.createDMBody)["static"];
export type SendMessageBody = (typeof ChatModel.sendMessageBody)["static"];
export type MessagesQuery = (typeof ChatModel.messagesQuery)["static"];

export type ConversationItem = (typeof ChatModel.conversationItem)["static"];
export type MessageItem = (typeof ChatModel.messageItem)["static"];

export type WSClientMessage = (typeof ChatModel.wsClientMessage)["static"];
export type WSServerMessage = (typeof ChatModel.wsServerMessage)["static"];

export type ChatError = (typeof ChatModel.chatError)["static"];

/**
 * Maps chat errors to RFC 9457 Problem Details.
 */
export function mapChatError(error: ChatError, instance: string) {
  switch (error.type) {
    case "CHANNEL_NOT_FOUND":
      return notFound("Channel not found", { instance });
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "NOT_A_MEMBER":
      return forbidden("You are not a member of this channel", { instance });
    case "CANNOT_MESSAGE_SELF":
      return badRequest("Cannot start a conversation with yourself", {
        instance,
      });
    case "USER_BLOCKED":
      return forbidden("Cannot message this user", { instance });
    case "MESSAGE_TOO_LONG":
      return badRequest("Message exceeds maximum length of 2000 characters", {
        instance,
      });
    case "EMPTY_MESSAGE":
      return badRequest("Message cannot be empty", { instance });
  }
}
