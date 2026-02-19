<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	class={cn(
		'flex flex-col gap-6 rounded-[var(--md3-shape-medium)] bg-md3-surface-container-low py-6 text-md3-on-surface shadow-sm transition-shadow duration-[var(--md3-duration-short4)] ease-[var(--md3-easing-standard)]',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
