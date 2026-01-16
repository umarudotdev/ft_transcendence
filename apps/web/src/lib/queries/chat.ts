import type {
  ConversationItem,
  MessageItem,
} from "@api/modules/chat/chat.model";

import { api } from "$lib/api";
import { ApiError, createApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  conversation: (channelId: number) =>
    [...chatKeys.all, "conversation", channelId] as const,
  messages: (channelId: number, before?: number) =>
    [...chatKeys.all, "messages", channelId, before] as const,
};

export type { ConversationItem, MessageItem };

export type Conversation = ConversationItem;
export type Message = MessageItem;

/**
 * Query to fetch all conversations for the current user
 */
export function createConversationsQuery() {
  return createQuery<Conversation[], ApiError>(() => ({
    queryKey: chatKeys.conversations(),
    queryFn: async () => {
      const response = await api.api.chat.conversations.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { conversations: Conversation[] };
      return data.conversations.map((c) => ({
        ...c,
        updatedAt: new Date(c.updatedAt),
        lastMessage: c.lastMessage
          ? {
              ...c.lastMessage,
              createdAt: new Date(c.lastMessage.createdAt),
            }
          : undefined,
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
  }));
}

/**
 * Query to fetch channel info
 */
export function createChannelQuery(channelId: number) {
  return createQuery<
    {
      channelId: number;
      type: "dm" | "public" | "private";
      name: string | null;
      participant?: {
        id: number;
        displayName: string;
        avatarUrl: string | null;
      };
    } | null,
    ApiError
  >(() => ({
    queryKey: chatKeys.conversation(channelId),
    queryFn: async () => {
      const response = await api.api.chat.conversations({ channelId }).get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        return null;
      }

      const data = response.data as {
        channel: {
          channelId: number;
          type: "dm" | "public" | "private";
          name: string | null;
          participant?: {
            id: number;
            displayName: string;
            avatarUrl: string | null;
          };
        };
      };

      return data.channel;
    },
    enabled: channelId > 0,
  }));
}

/**
 * Query to fetch messages for a channel
 */
export function createMessagesQuery(
  channelId: number,
  options?: { limit?: number; before?: number }
) {
  return createQuery<Message[], ApiError>(() => ({
    queryKey: chatKeys.messages(channelId, options?.before),
    queryFn: async () => {
      const response = await api.api.chat
        .conversations({ channelId })
        .messages.get({
          query: options ?? {},
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { messages: Message[] };
      return data.messages.map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        editedAt: m.editedAt ? new Date(m.editedAt) : null,
      }));
    },
    enabled: channelId > 0,
  }));
}

/**
 * Mutation to create or get a DM with another user
 */
export function createDMMutation() {
  const queryClient = useQueryClient();

  return createMutation<
    { channelId: number; isNew: boolean },
    ApiError,
    number
  >(() => ({
    mutationFn: async (userId) => {
      const response = await api.api.chat.conversations.dm.post(
        { userId },
        {
          fetch: { credentials: "include" },
        }
      );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as { channelId: number; isNew: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  }));
}

/**
 * Mutation to send a message via REST (fallback for WebSocket)
 */
export function createSendMessageMutation() {
  const queryClient = useQueryClient();

  return createMutation<
    Message,
    ApiError,
    { channelId: number; content: string }
  >(() => ({
    mutationFn: async ({ channelId, content }) => {
      const response = await api.api.chat
        .conversations({ channelId })
        .messages.post(
          { content },
          {
            fetch: { credentials: "include" },
          }
        );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { message: Message };
      return {
        ...data.message,
        createdAt: new Date(data.message.createdAt),
        editedAt: data.message.editedAt
          ? new Date(data.message.editedAt)
          : null,
      };
    },
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(channelId),
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  }));
}

/**
 * Mutation to mark a channel as read
 */
export function createMarkAsReadMutation() {
  const queryClient = useQueryClient();

  return createMutation<{ readAt: Date }, ApiError, number>(() => ({
    mutationFn: async (channelId) => {
      const response = await api.api.chat
        .conversations({ channelId })
        .read.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as unknown as { readAt: string };
      return { readAt: new Date(data.readAt) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  }));
}
