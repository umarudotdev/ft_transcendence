import { QueryClient } from "@tanstack/svelte-query";

/**
 * Create a new QueryClient instance with default options.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered stale immediately
        staleTime: 0,
        // Retry failed requests once
        retry: 1,
        // Refetch on window focus
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Don't retry mutations
        retry: false,
      },
    },
  });
}
