<script lang="ts">
	import { goto } from '$app/navigation';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { createConversationsQuery } from '$lib/queries/chat';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ConversationItem from './ConversationItem.svelte';

	interface Props {
		selectedChannelId?: number;
	}

	let { selectedChannelId }: Props = $props();

	const conversationsQuery = createConversationsQuery();

	function handleSelectConversation(channelId: number) {
		goto(`/chat/${channelId}`);
	}
</script>

<div class="flex h-full flex-col">
	<div class="border-b p-4">
		<h2 class="text-lg font-semibold">Messages</h2>
	</div>

	<ScrollArea class="flex-1">
		{#if conversationsQuery.isPending}
			<div class="space-y-2 p-3">
				{#each Array(5) as _}
					<div class="flex items-center gap-3 p-2">
						<Skeleton class="size-10 shrink-0 rounded-full" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-32" />
							<Skeleton class="h-3 w-48" />
						</div>
					</div>
				{/each}
			</div>
		{:else if conversationsQuery.isError}
			<div class="flex flex-col items-center justify-center p-8 text-center">
				<p class="text-sm text-muted-foreground">Failed to load conversations</p>
			</div>
		{:else if conversationsQuery.data?.length === 0}
			<div class="flex flex-col items-center justify-center p-8 text-center">
				<MessageSquareIcon class="mb-2 size-10 text-muted-foreground" />
				<p class="font-medium">No conversations yet</p>
				<p class="text-sm text-muted-foreground">Start a chat by visiting a user's profile</p>
			</div>
		{:else if conversationsQuery.data}
			<div class="p-2">
				{#each conversationsQuery.data as conversation (conversation.channelId)}
					<ConversationItem
						{conversation}
						isSelected={conversation.channelId === selectedChannelId}
						onclick={() => handleSelectConversation(conversation.channelId)}
					/>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</div>
