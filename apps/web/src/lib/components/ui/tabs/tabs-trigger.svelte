<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		// MD3 Tab trigger styles
		'relative inline-flex h-full flex-1 items-center justify-center gap-1.5 px-4',
		// Typography
		'md3-title-small text-md3-on-surface-variant',
		// Active state
		'data-[state=active]:text-md3-primary',
		// Active indicator (bottom border)
		'after:absolute after:bottom-0 after:left-1/2 after:h-[3px] after:w-0 after:-translate-x-1/2',
		'after:rounded-t-full after:bg-md3-primary after:transition-all',
		'after:duration-[var(--md3-duration-short4)] after:ease-[var(--md3-easing-standard)]',
		'data-[state=active]:after:w-full',
		// Hover state layer
		'hover:bg-md3-on-surface/8',
		// Transition
		'transition-colors duration-[var(--md3-duration-short2)] ease-[var(--md3-easing-standard)]',
		// Focus
		'outline-none focus-visible:bg-md3-on-surface/12',
		// Disabled
		'disabled:pointer-events-none disabled:opacity-38',
		// Icons
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
/>
