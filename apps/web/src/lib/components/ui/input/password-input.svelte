<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import EyeOffIcon from "@lucide/svelte/icons/eye-off";

	type Props = WithElementRef<Omit<HTMLInputAttributes, "type">>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();

	let showPassword = $state(false);

	// Input base styles (same as Input component)
	const inputBase = [
		// Layout
		"flex h-14 w-full min-w-0 px-4 py-4 pr-12",
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

<div class="relative">
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(inputBase, className)}
		type={showPassword ? "text" : "password"}
		bind:value
		{...restProps}
	/>
	<button
		type="button"
		class={cn(
			"absolute right-3 top-1/2 -translate-y-1/2",
			"flex size-8 items-center justify-center rounded-full",
			"text-muted-foreground hover:text-foreground",
			"hover:bg-accent active:bg-accent/80",
			"transition-colors",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		)}
		onclick={() => (showPassword = !showPassword)}
		aria-label={showPassword ? "Hide password" : "Show password"}
		aria-pressed={showPassword}
	>
		{#if showPassword}
			<EyeOffIcon class="size-5" />
		{:else}
			<EyeIcon class="size-5" />
		{/if}
	</button>
</div>
