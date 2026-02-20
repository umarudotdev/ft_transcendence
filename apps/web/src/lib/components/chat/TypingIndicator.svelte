<script lang="ts">
	import { getChatStore } from '$lib/stores/chat.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		channelId: number;
	}

	let { channelId }: Props = $props();

	const chatStore = getChatStore();

	let typingUsers = $derived(chatStore.getTypingUsers(channelId));
</script>

{#if typingUsers.length > 0}
	<div class="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
		<div class="flex gap-1">
			<span class="animate-bounce" style="animation-delay: 0ms;">.</span>
			<span class="animate-bounce" style="animation-delay: 150ms;">.</span>
			<span class="animate-bounce" style="animation-delay: 300ms;">.</span>
		</div>
		<span>
			{#if typingUsers.length === 1}
				{m.chat_typing_one()}
			{:else}
				{m.chat_typing_many({ count: typingUsers.length })}
			{/if}
		</span>
	</div>
{/if}
