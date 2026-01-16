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

	// MD3 Input base styles
	const inputBase = [
		// Layout
		"flex h-14 w-full min-w-0 px-4 py-4",
		// Shape
		"rounded-[var(--md3-shape-extra-small)]",
		// Colors
		"bg-md3-surface-container-highest text-md3-on-surface",
		"border border-md3-outline",
		// Typography
		"md3-body-large",
		// Placeholder
		"placeholder:text-md3-on-surface-variant",
		// Selection
		"selection:bg-primary selection:text-primary-foreground",
		// Transition
		"transition-all duration-[var(--md3-duration-short2)] ease-[var(--md3-easing-standard)]",
		// Focus
		"outline-none focus-visible:border-md3-primary focus-visible:border-2",
		"focus-visible:ring-0",
		// Invalid
		"aria-invalid:border-md3-error aria-invalid:border-2",
		// Disabled
		"disabled:cursor-not-allowed disabled:opacity-38",
		// Dark mode
		"dark:bg-md3-surface-container-high",
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
