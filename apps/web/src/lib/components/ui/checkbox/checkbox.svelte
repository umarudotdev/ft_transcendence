<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(
		// MD3 Checkbox styles
		'peer flex size-[18px] shrink-0 items-center justify-center',
		// Unchecked state
		'rounded-[2px] border-2 border-md3-on-surface-variant',
		// Checked state
		'data-[state=checked]:border-md3-primary data-[state=checked]:bg-md3-primary',
		'data-[state=checked]:text-md3-on-primary',
		// Indeterminate state
		'data-[state=indeterminate]:border-md3-primary data-[state=indeterminate]:bg-md3-primary',
		'data-[state=indeterminate]:text-md3-on-primary',
		// Transition
		'transition-all duration-[var(--md3-duration-short2)] ease-[var(--md3-easing-standard)]',
		// Focus
		'outline-none focus-visible:ring-[3px] focus-visible:ring-md3-primary/20',
		// Invalid
		'aria-invalid:border-md3-error aria-invalid:ring-md3-error/20',
		'aria-invalid:data-[state=checked]:border-md3-error aria-invalid:data-[state=checked]:bg-md3-error',
		// Disabled
		'disabled:cursor-not-allowed disabled:opacity-38',
		className
	)}
	bind:checked
	bind:indeterminate
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<div data-slot="checkbox-indicator" class="text-current transition-none">
			{#if checked}
				<CheckIcon class="size-3.5" />
			{:else if indeterminate}
				<MinusIcon class="size-3.5" />
			{/if}
		</div>
	{/snippet}
</CheckboxPrimitive.Root>
