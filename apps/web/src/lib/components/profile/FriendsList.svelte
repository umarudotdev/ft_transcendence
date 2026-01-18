<script lang="ts">
  import { goto } from "$app/navigation";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getInitials } from "$lib/utils";
  import type { Friend, FriendRequest } from "$lib/queries/users";

  interface Props {
    friends: Friend[];
    pendingRequests?: FriendRequest[];
    loading?: boolean;
    showPending?: boolean;
    onRemoveFriend?: (userId: number) => void;
    onAcceptRequest?: (requestId: number) => void;
    onRejectRequest?: (requestId: number) => void;
  }

  let {
    friends,
    pendingRequests = [],
    loading = false,
    showPending = false,
    onRemoveFriend,
    onAcceptRequest,
    onRejectRequest,
  }: Props = $props();

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }
</script>

<Card>
  <CardHeader class="pb-2">
    <CardTitle class="text-lg">
      Friends
      {#if friends.length > 0}
        <Badge variant="secondary" class="ml-2">{friends.length}</Badge>
      {/if}
    </CardTitle>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-3">
        {#each Array(3) as _}
          <div class="flex items-center gap-3">
            <Skeleton class="h-10 w-10 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-1/3" />
              <Skeleton class="h-3 w-1/4" />
            </div>
          </div>
        {/each}
      </div>
    {:else}
      {#if showPending && pendingRequests.length > 0}
        <div class="mb-4">
          <h4 class="mb-2 text-sm font-medium text-muted-foreground">
            Pending Requests ({pendingRequests.length})
          </h4>
          <div class="space-y-2">
            {#each pendingRequests as request}
              <div
                class="flex items-center justify-between rounded-lg border border-dashed p-3"
              >
                <div class="flex items-center gap-3">
                  <Avatar class="h-10 w-10">
                    {#if request.from.avatarUrl}
                      <AvatarImage
                        src={request.from.avatarUrl}
                        alt={request.from.displayName}
                      />
                    {/if}
                    <AvatarFallback>
                      {getInitials(request.from.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span class="font-medium">{request.from.displayName}</span>
                    <div class="text-xs text-muted-foreground">
                      Sent {formatDate(request.createdAt)}
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    onclick={() => onAcceptRequest?.(request.requestId)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onclick={() => onRejectRequest?.(request.requestId)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if friends.length === 0}
        <div class="py-8 text-center text-muted-foreground">
          <p>No friends yet.</p>
          <p class="mt-1 text-sm">Add friends to see them here!</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each friends as friend}
            <div
              class="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <button
                type="button"
                class="flex flex-1 cursor-pointer items-center gap-3 text-left"
                onclick={() => goto(`/users/${friend.id}`)}
              >
                <Avatar class="h-10 w-10">
                  {#if friend.avatarUrl}
                    <AvatarImage
                      src={friend.avatarUrl}
                      alt={friend.displayName}
                    />
                  {/if}
                  <AvatarFallback>
                    {getInitials(friend.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span class="font-medium">{friend.displayName}</span>
                  <div class="text-xs text-muted-foreground">
                    Friends since {formatDate(friend.since)}
                  </div>
                </div>
              </button>
              {#if onRemoveFriend}
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  onclick={() => onRemoveFriend?.(friend.id)}
                >
                  Remove
                </Button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </CardContent>
</Card>
