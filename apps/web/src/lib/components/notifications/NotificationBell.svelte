<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import { createUnreadCountQuery } from "$lib/queries/notifications";
  import BellIcon from "@lucide/svelte/icons/bell";
  import NotificationDropdown from "./NotificationDropdown.svelte";

  let open = $state(false);

  const unreadQuery = createUnreadCountQuery();
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon-sm" class="relative" {...props}>
        <BellIcon class="size-4" />
        {#if unreadQuery.data && unreadQuery.data > 0}
          <span
            class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-md3-error text-[10px] font-bold text-md3-on-error"
          >
            {unreadQuery.data > 99 ? "99+" : unreadQuery.data}
          </span>
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-80 p-0" align="end">
    <NotificationDropdown onClose={() => (open = false)} />
  </Popover.Content>
</Popover.Root>
