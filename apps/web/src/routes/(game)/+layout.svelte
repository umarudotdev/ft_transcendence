<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	let { children } = $props();
	let showControls = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function handleMouseMove() {
		showControls = true;
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			showControls = false;
		}, 3000);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0a0a1a]"
	onmousemove={handleMouseMove}
>
	<!-- Radial vignette -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_transparent_50%,_rgba(0,0,0,0.4)_100%)]"
	></div>

	<!-- Back button -->
	<a
		href="/play"
		class="absolute top-4 left-4 z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-all duration-300 hover:bg-white/10 hover:text-white"
		class:opacity-0={!showControls}
		class:pointer-events-none={!showControls}
	>
		<ArrowLeftIcon class="size-4" />
		<span>Back</span>
	</a>

	<!-- Content -->
	<div class="relative z-10">
		{@render children()}
	</div>
</div>
