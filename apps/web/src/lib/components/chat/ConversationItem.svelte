<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { getInitials } from '$lib/utils';
	import type { Conversation } from '$lib/queries/chat';

	interface Props {
		conversation: Conversation;
		isSelected?: boolean;
		onclick?: () => void;
	}

	let { conversation, isSelected = false, onclick }: Props = $props();

	function formatTime(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m`;
		if (hours < 24) return `${hours}h`;
		if (days < 7) return `${days}d`;

		return date.toLocaleDateString();
	}

	function getDisplayName(): string {
		if (conversation.type === 'dm' && conversation.participant) {
			return conversation.participant.displayName;
		}
		return conversation.name ?? 'Unnamed Channel';
	}
</script>

<button
	class="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors
    {isSelected ? 'bg-primary/10' : 'hover:bg-muted'}"
	{onclick}
>
	<Avatar class="size-10 shrink-0">
		<AvatarImage src={conversation.participant?.avatarUrl ?? undefined} alt={getDisplayName()} />
		<AvatarFallback class="text-sm">
			{getInitials(getDisplayName())}
		</AvatarFallback>
	</Avatar>

	<div class="min-w-0 flex-1">
		<div class="flex items-center justify-between">
			<span class="truncate font-medium">{getDisplayName()}</span>
			{#if conversation.lastMessage}
				<span class="shrink-0 text-xs text-muted-foreground">
					{formatTime(conversation.lastMessage.createdAt)}
				</span>
			{/if}
		</div>
		{#if conversation.lastMessage}
			<p class="truncate text-sm text-muted-foreground">
				{conversation.lastMessage.senderName}: {conversation.lastMessage.content}
			</p>
		{:else}
			<p class="text-sm text-muted-foreground italic">No messages yet</p>
		{/if}
	</div>

	{#if conversation.unreadCount > 0}
		<span
			class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
		>
			{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
		</span>
	{/if}
</button>
