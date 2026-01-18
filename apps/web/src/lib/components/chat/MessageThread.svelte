<script lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { createMessagesQuery, type Message } from "$lib/queries/chat";
  import { getChatStore } from "$lib/stores/chat.svelte";
  import { getInitials } from "$lib/utils";
  import { onMount } from "svelte";
  import TypingIndicator from "./TypingIndicator.svelte";

  interface Props {
    channelId: number;
    currentUserId: number;
  }

  let { channelId, currentUserId }: Props = $props();

  // Create query reactively based on channelId prop
  let messagesQuery = $derived(createMessagesQuery(channelId));
  const chatStore = getChatStore();

  let scrollContainer: HTMLElement | null = $state(null);
  let isAtBottom = $state(true);

  function scrollToBottom(smooth = false) {
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }

  function handleScroll() {
    if (scrollContainer) {
      const threshold = 100;
      isAtBottom =
        scrollContainer.scrollHeight -
          scrollContainer.scrollTop -
          scrollContainer.clientHeight <
        threshold;
    }
  }

  // Scroll to bottom when messages change
  $effect(() => {
    if (messagesQuery.data && isAtBottom) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => scrollToBottom(), 0);
    }
  });

  // Subscribe to new messages
  onMount(() => {
    const unsubscribe = chatStore.onMessage((msg) => {
      if (
        (msg.type === "new_message" || msg.type === "message_sent") &&
        msg.data.channelId === channelId
      ) {
        if (isAtBottom) {
          setTimeout(() => scrollToBottom(true), 0);
        }
      }
    });

    // Mark as read when viewing
    chatStore.markRead(channelId);

    return unsubscribe;
  });

  function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(date: Date): string {
    const today = new Date();
    const messageDate = new Date(date);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Today";
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return messageDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function shouldShowDateSeparator(
    current: Message,
    previous: Message | undefined
  ): boolean {
    if (!previous) return true;

    const currentDate = new Date(current.createdAt).toDateString();
    const previousDate = new Date(previous.createdAt).toDateString();

    return currentDate !== previousDate;
  }

  function isOwnMessage(message: Message): boolean {
    return message.sender.id === currentUserId;
  }
</script>

<div class="flex h-full flex-col">
  <ScrollArea
    class="flex-1"
    bind:ref={scrollContainer}
    onscroll={handleScroll}
  >
    {#if messagesQuery.isPending}
      <div class="space-y-4 p-4">
        {#each Array(5) as _, i}
          <div class="flex gap-3 {i % 2 === 0 ? '' : 'flex-row-reverse'}">
            <Skeleton class="size-8 shrink-0 rounded-full" />
            <div class="space-y-1">
              <Skeleton class="h-4 w-24" />
              <Skeleton class="h-12 w-48 rounded-lg" />
            </div>
          </div>
        {/each}
      </div>
    {:else if messagesQuery.isError}
      <div class="flex h-full items-center justify-center">
        <p class="text-muted-foreground">Failed to load messages</p>
      </div>
    {:else if messagesQuery.data?.length === 0}
      <div class="flex h-full flex-col items-center justify-center text-center">
        <p class="text-muted-foreground">No messages yet</p>
        <p class="text-sm text-muted-foreground">
          Be the first to send a message!
        </p>
      </div>
    {:else if messagesQuery.data}
      <div class="space-y-4 p-4">
        {#each messagesQuery.data as message, i (message.id)}
          {@const previous = messagesQuery.data[i - 1]}
          {@const isOwn = isOwnMessage(message)}

          {#if shouldShowDateSeparator(message, previous)}
            <div class="flex items-center gap-2 py-2">
              <div class="h-px flex-1 bg-border"></div>
              <span class="text-xs text-muted-foreground">
                {formatDate(message.createdAt)}
              </span>
              <div class="h-px flex-1 bg-border"></div>
            </div>
          {/if}

          <div class="flex gap-3 {isOwn ? 'flex-row-reverse' : ''}">
            {#if !isOwn}
              <Avatar class="size-8 shrink-0">
                <AvatarImage
                  src={message.sender.avatarUrl ?? undefined}
                  alt={message.sender.displayName}
                />
                <AvatarFallback class="text-xs">
                  {getInitials(message.sender.displayName)}
                </AvatarFallback>
              </Avatar>
            {/if}

            <div class="max-w-[70%] space-y-1 {isOwn ? 'items-end' : ''}">
              {#if !isOwn}
                <span class="text-xs text-muted-foreground">
                  {message.sender.displayName}
                </span>
              {/if}
              <div
                class="rounded-lg px-3 py-2 {isOwn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'}"
              >
                <p class="whitespace-pre-wrap break-words text-sm">
                  {message.content}
                </p>
              </div>
              <span
                class="block text-xs text-muted-foreground {isOwn
                  ? 'text-right'
                  : ''}"
              >
                {formatTime(message.createdAt)}
                {#if message.editedAt}
                  <span class="italic">(edited)</span>
                {/if}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <TypingIndicator {channelId} />
  </ScrollArea>
</div>
