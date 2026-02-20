<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import { createMeQuery } from '$lib/queries/auth';

	let { children } = $props();

	const meQuery = createMeQuery();

	const isAdmin = $derived(meQuery.data?.role === 'admin' || meQuery.data?.role === 'moderator');

	// Redirect non-admins to home page
	$effect(() => {
		if (meQuery.data && !isAdmin) {
			goto('/');
		}
	});
</script>

{#if meQuery.isPending}
	<div class="flex h-full items-center justify-center">
		<div class="text-muted-foreground">{m.admin_layout_loading()}</div>
	</div>
{:else if meQuery.error || !isAdmin}
	<div class="flex h-full flex-col items-center justify-center gap-4">
		<h1 class="text-2xl font-bold">{m.admin_layout_access_denied()}</h1>
		<p class="text-muted-foreground">{m.admin_layout_no_permission()}</p>
		<a href="/" class="text-primary underline">{m.admin_layout_go_home()}</a>
	</div>
{:else}
	{@render children()}
{/if}
