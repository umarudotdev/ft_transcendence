<script lang="ts">
	import FlameIcon from '@lucide/svelte/icons/flame';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		currentStreak: number;
		longestStreak?: number;
		size?: 'sm' | 'md' | 'lg';
		showLongest?: boolean;
	}

	let { currentStreak, longestStreak, size = 'md', showLongest = false }: Props = $props();

	const sizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg'
	};

	const iconSizeClasses = {
		sm: 'size-3',
		md: 'size-4',
		lg: 'size-5'
	};

	const isHotStreak = $derived(currentStreak >= 5);
</script>

<div class="inline-flex items-center gap-2 {sizeClasses[size]}">
	<span
		class="inline-flex items-center gap-1 font-medium {isHotStreak
			? 'text-orange-500'
			: 'text-muted-foreground'}"
	>
		<FlameIcon class="{iconSizeClasses[size]} {isHotStreak ? 'animate-pulse' : ''}" />
		<span class="font-mono">{currentStreak}</span>
		<span class="text-muted-foreground">{m.gamification_day({ count: currentStreak })}</span>
	</span>
	{#if showLongest && longestStreak !== undefined}
		<span class="text-xs text-muted-foreground">{m.gamification_best({ count: longestStreak })}</span>
	{/if}
</div>
