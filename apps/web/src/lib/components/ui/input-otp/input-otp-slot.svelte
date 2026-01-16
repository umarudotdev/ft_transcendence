<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		cell,
		class: className,
		...restProps
	}: InputOTPPrimitive.CellProps = $props();
</script>

<InputOTPPrimitive.Cell
	{cell}
	bind:ref
	data-slot="input-otp-slot"
	class={cn(
		// MD3 OTP Slot styles
		"relative flex size-12 items-center justify-center",
		// Typography
		"md3-headline-small text-md3-on-surface",
		// Colors and borders
		"bg-md3-surface-container-highest",
		"border border-md3-outline",
		// Shape - individual slots with connected borders
		"border-y border-e first:rounded-s-[var(--md3-shape-small)] first:border-s last:rounded-e-[var(--md3-shape-small)]",
		// Transition
		"transition-all duration-[var(--md3-duration-short2)] ease-[var(--md3-easing-standard)]",
		"outline-none",
		// Active state
		cell.isActive && [
			"z-10 border-md3-primary border-2",
			"ring-[3px] ring-md3-primary/20",
		],
		// Invalid state
		"aria-invalid:border-md3-error aria-invalid:ring-md3-error/20",
		className
	)}
	{...restProps}
>
	{cell.char}
	{#if cell.hasFakeCaret}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="animate-caret-blink bg-md3-primary h-5 w-0.5 duration-1000"></div>
		</div>
	{/if}
</InputOTPPrimitive.Cell>
