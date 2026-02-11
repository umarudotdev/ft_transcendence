<script lang="ts">
	import { browser } from '$app/environment';
	import { SuperCluster } from '$lib/supercluster';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const wsUrl = browser
		? import.meta.env.DEV
			? 'ws://localhost:3000/api/game/ws'
			: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/game/ws`
		: '';
</script>

<svelte:head>
	<title>SuperCluster | ft_transcendence</title>
</svelte:head>

<div class="flex h-full flex-col">
	<!-- <div class="flex items-center gap-4 pb-4">
		<Button variant="ghost" size="sm" href="/" class="gap-2">
			<ArrowLeftIcon class="size-4" />
			Back to Lobby
		</Button>
		<h1 class="text-xl font-bold">SuperCluster</h1>
	</div> -->

	<div class="relative flex-1 overflow-hidden rounded-lg border bg-black">
		<SuperCluster debug={true} {wsUrl} />
	</div>
</div>
