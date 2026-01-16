<script lang="ts">
	import { goto } from "$app/navigation";
	import { createMeQuery } from "$lib/queries/auth";

	let { children } = $props();

	const meQuery = createMeQuery();

	const isAdmin = $derived(
		meQuery.data?.role === "admin" || meQuery.data?.role === "moderator"
	);

	// Redirect non-admins to home page
	$effect(() => {
		if (meQuery.data && !isAdmin) {
			goto("/");
		}
	});
</script>

{#if meQuery.isPending}
	<div class="flex h-full items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:else if meQuery.error || !isAdmin}
	<div class="flex h-full flex-col items-center justify-center gap-4">
		<h1 class="text-2xl font-bold">Access Denied</h1>
		<p class="text-muted-foreground">You don't have permission to access this page.</p>
		<a href="/" class="text-primary underline">Go to Home</a>
	</div>
{:else}
	{@render children()}
{/if}
