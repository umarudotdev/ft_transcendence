<script lang="ts">
	import { browser } from '$app/environment';
	import { SuperCluster } from '$lib/game';

	const wsUrl = browser
		? import.meta.env.DEV
			? 'ws://localhost:9944/ws'
			: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/game/ws`
		: '';
</script>

<svelte:head>
	<title>SuperCluster | ft_transcendence</title>
</svelte:head>

<SuperCluster debug={true} {wsUrl} />
