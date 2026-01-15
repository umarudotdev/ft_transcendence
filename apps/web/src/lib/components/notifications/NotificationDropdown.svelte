<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import {
    createNotificationsQuery,
    createMarkAsReadMutation,
    createMarkAllAsReadMutation,
    getNotificationColor,
    type Notification,
  } from "$lib/queries/notifications";
  import BellIcon from "@lucide/svelte/icons/bell";
  import GamepadIcon from "@lucide/svelte/icons/gamepad-2";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import InfoIcon from "@lucide/svelte/icons/info";
  import CheckCheckIcon from "@lucide/svelte/icons/check-check";

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  const notificationsQuery = createNotificationsQuery({ limit: 10 });
  const markAsReadMutation = createMarkAsReadMutation();
  const markAllAsReadMutation = createMarkAllAsReadMutation();

  function getIcon(type: Notification["type"]) {
    switch (type) {
      case "match_invite":
        return GamepadIcon;
      case "friend_request":
        return UserPlusIcon;
      case "achievement":
        return TrophyIcon;
      case "rank_change":
        return TrendingUpIcon;
      case "system":
        return InfoIcon;
      default:
        return BellIcon;
    }
  }

  function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
  }

  async function handleClick(notification: Notification) {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    onClose?.();
  }

  async function handleMarkAllRead() {
    await markAllAsReadMutation.mutateAsync();
  }

  function handleViewAll() {
    goto("/notifications");
    onClose?.();
  }
</script>

<div class="flex flex-col">
  <div class="flex items-center justify-between border-b p-3">
    <h3 class="font-semibold">Notifications</h3>
    {#if notificationsQuery.data?.notifications.some((n) => !n.isRead)}
      <Button
        variant="ghost"
        size="sm"
        onclick={handleMarkAllRead}
        disabled={markAllAsReadMutation.isPending}
      >
        <CheckCheckIcon class="mr-1 size-4" />
        Mark all read
      </Button>
    {/if}
  </div>

  <ScrollArea class="h-80">
    {#if notificationsQuery.isPending}
      <div class="space-y-2 p-3">
        {#each Array(3) as _}
          <div class="flex gap-3">
            <Skeleton class="size-10 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-full" />
            </div>
          </div>
        {/each}
      </div>
    {:else if notificationsQuery.data?.notifications.length === 0}
      <div class="flex flex-col items-center justify-center p-8 text-center">
        <BellIcon class="mb-2 size-10 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">No notifications yet</p>
      </div>
    {:else if notificationsQuery.data}
      <div class="divide-y">
        {#each notificationsQuery.data.notifications as notification}
          {@const Icon = getIcon(notification.type)}
          <button
            class="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted {notification.isRead
              ? 'opacity-60'
              : ''}"
            onclick={() => handleClick(notification)}
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full {getNotificationColor(
                notification.type
              )}"
            >
              <Icon class="size-5" />
            </div>
            <div class="flex-1 overflow-hidden">
              <p class="truncate font-medium">{notification.title}</p>
              <p class="truncate text-sm text-muted-foreground">
                {notification.message}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                {formatTime(notification.createdAt)}
              </p>
            </div>
            {#if !notification.isRead}
              <div class="mt-2 size-2 shrink-0 rounded-full bg-blue-500"></div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </ScrollArea>

  <div class="border-t p-2">
    <Button variant="ghost" class="w-full" onclick={handleViewAll}>
      View all notifications
    </Button>
  </div>
</div>
