<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();

	// Input base styles
	const inputBase = [
		// Layout
		"flex h-14 w-full min-w-0 px-4 py-4",
		// Shape
		"rounded-[var(--md3-shape-extra-small)]",
		// Colors
		"bg-transparent text-foreground",
		"border border-input",
		// Typography
		"text-base",
		// Placeholder
		"placeholder:text-muted-foreground",
		// Selection
		"selection:bg-primary selection:text-primary-foreground",
		// Transition
		"transition-[color,box-shadow]",
		// Focus
		"outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
		// Invalid
		"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
		// Disabled
		"disabled:cursor-not-allowed disabled:opacity-50",
		// Dark mode
		"dark:bg-input/30",
	];
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			inputBase,
			"pt-1.5 text-sm font-medium",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			inputBase,
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
