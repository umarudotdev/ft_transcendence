<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { m } from '$lib/paraglide/messages.js';
</script>

<div class="hidden h-full flex-col items-center justify-center lg:flex">
	<div class="text-center">
		<MessageSquareIcon class="mx-auto mb-4 size-16 text-muted-foreground" />
		<h2 class="text-xl font-semibold">{m.chat_select_conversation()}</h2>
		<p class="mt-2 text-muted-foreground">
			{m.chat_select_conversation_hint()}
		</p>
	</div>
</div>

<div class="lg:hidden">
	<!-- On mobile, the conversation list is shown instead -->
</div>
