<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		'data-slot': dataSlot = 'textarea',
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();

	// Textarea base styles (consistent with Input)
	const textareaBase = [
		// Layout
		'flex field-sizing-content min-h-16 w-full min-w-0 px-4 py-4',
		// Shape
		'rounded-[var(--md3-shape-extra-small)]',
		// Colors
		'bg-transparent text-foreground',
		'border border-input',
		// Typography
		'text-base',
		// Placeholder
		'placeholder:text-muted-foreground',
		// Selection
		'selection:bg-primary selection:text-primary-foreground',
		// Transition
		'transition-[color,box-shadow]',
		// Focus
		'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
		// Invalid
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		// Disabled
		'disabled:cursor-not-allowed disabled:opacity-50',
		// Dark mode
		'dark:bg-input/30'
	];
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(textareaBase, className)}
	bind:value
	{...restProps}
></textarea>
