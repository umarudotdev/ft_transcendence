import { api } from "$lib/api";
import { createApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const gameKeys = {
  all: ["game"] as const,
  queueStatus: () => [...gameKeys.all, "queue-status"] as const,
};

export function createQueueStatusQuery() {
  return createQuery<{ inQueue: boolean; position: number }, Error>(() => ({
    queryKey: gameKeys.queueStatus(),
    queryFn: async () => {
      const response = await api.api.matchmaking.queue.status.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as { inQueue: boolean; position: number };
    },
    refetchInterval: 5000,
  }));
}

export function createJoinQueueMutation() {
  const queryClient = useQueryClient();

  return createMutation<
    { position: number; estimatedWait: number },
    Error,
    { mode?: string }
  >(() => ({
    mutationFn: async ({ mode }) => {
      const response = await api.api.matchmaking.queue.post(
        { mode: mode as "ranked" | "casual" | undefined },
        { fetch: { credentials: "include" } }
      );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as { position: number; estimatedWait: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.queueStatus() });
    },
  }));
}

export function createLeaveQueueMutation() {
  const queryClient = useQueryClient();

  return createMutation<{ success: boolean }, Error, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.matchmaking.queue.delete({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.queueStatus() });
    },
  }));
}
