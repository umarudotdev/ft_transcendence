<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { MessageInput, MessageThread } from "$lib/components/chat";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { createMeQuery } from "$lib/queries/auth";
  import { createChannelQuery } from "$lib/queries/chat";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  let channelId = $derived(Number(page.params.channelId));

  const meQuery = createMeQuery();
  // Create query reactively based on derived channelId
  let channelQuery = $derived(createChannelQuery(channelId));

  function getDisplayName(): string {
    if (!channelQuery.data) return "";

    if (channelQuery.data.type === "dm" && channelQuery.data.participant) {
      return channelQuery.data.participant.displayName;
    }
    return channelQuery.data.name ?? "Channel";
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function handleBack() {
    goto("/chat");
  }
</script>

<div class="flex h-full flex-col">
  <!-- Header -->
  <div class="flex shrink-0 items-center gap-3 border-b px-4 py-3">
    <Button
      variant="ghost"
      size="icon"
      class="lg:hidden"
      onclick={handleBack}
    >
      <ArrowLeftIcon class="size-5" />
      <span class="sr-only">Back to conversations</span>
    </Button>

    {#if channelQuery.isPending}
      <Skeleton class="size-10 rounded-full" />
      <Skeleton class="h-5 w-32" />
    {:else if channelQuery.data}
      <Avatar class="size-10">
        <AvatarImage
          src={channelQuery.data.participant?.avatarUrl ?? undefined}
          alt={getDisplayName()}
        />
        <AvatarFallback>
          {getInitials(getDisplayName())}
        </AvatarFallback>
      </Avatar>
      <div>
        <h1 class="font-semibold">{getDisplayName()}</h1>
        {#if channelQuery.data.type === "dm"}
          <p class="text-xs text-muted-foreground">Direct message</p>
        {/if}
      </div>
    {:else}
      <span class="text-muted-foreground">Channel not found</span>
    {/if}
  </div>

  <!-- Messages -->
  {#if channelQuery.data && meQuery.data}
    <div class="min-h-0 flex-1">
      <MessageThread {channelId} currentUserId={meQuery.data.id} />
    </div>

    <!-- Input -->
    <MessageInput {channelId} />
  {:else if channelQuery.isError}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-muted-foreground">
        Could not load this conversation. It may not exist or you may not have
        access.
      </p>
    </div>
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <Skeleton class="size-8" />
    </div>
  {/if}
</div>
