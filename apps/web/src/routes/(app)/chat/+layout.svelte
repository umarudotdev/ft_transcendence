<script lang="ts">
  import { page } from "$app/state";
  import { ConversationList } from "$lib/components/chat";
  import { getChatStore } from "$lib/stores/chat.svelte";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { onMount } from "svelte";

  let { children } = $props();

  const chatStore = getChatStore();
  const queryClient = useQueryClient();

  // Get the selected channel ID from the route
  let selectedChannelId = $derived(
    page.params.channelId ? Number(page.params.channelId) : undefined
  );

  onMount(() => {
    // Set up query client for the chat store
    chatStore.setQueryClient(queryClient);

    // Connect WebSocket
    chatStore.connect();

    return () => {
      chatStore.disconnect();
    };
  });
</script>

<div class="-m-6 flex h-[calc(100vh-3.5rem)]">
  <!-- Sidebar with conversation list -->
  <div
    class="w-80 shrink-0 border-r bg-muted/30 {selectedChannelId
      ? 'hidden lg:block'
      : ''}"
  >
    <ConversationList {selectedChannelId} />
  </div>

  <!-- Main content area -->
  <div class="flex min-w-0 flex-1 flex-col">
    {@render children()}
  </div>
</div>
