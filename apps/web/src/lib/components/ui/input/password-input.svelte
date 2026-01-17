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

	// MD3 Input base styles (same as Input component)
	const inputBase = [
		// Layout
		"flex h-14 w-full min-w-0 px-4 py-4 pr-12",
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
			"text-md3-on-surface-variant hover:text-md3-on-surface",
			"hover:bg-md3-on-surface/8 active:bg-md3-on-surface/12",
			"transition-colors duration-[var(--md3-duration-short2)]",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md3-primary"
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
