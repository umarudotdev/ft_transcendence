<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class={cn(
		// MD3 Switch styles
		'peer inline-flex h-8 w-[52px] shrink-0 items-center rounded-full',
		// Track colors
		'data-[state=checked]:bg-md3-primary data-[state=unchecked]:bg-md3-surface-container-highest',
		'data-[state=unchecked]:border-2 data-[state=unchecked]:border-md3-outline',
		// Transition
		'transition-all duration-[var(--md3-duration-short4)] ease-[var(--md3-easing-standard)]',
		// Focus
		'outline-none focus-visible:ring-[3px] focus-visible:ring-md3-primary/20',
		// Disabled
		'disabled:cursor-not-allowed disabled:opacity-38',
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			// MD3 Switch thumb
			'pointer-events-none block rounded-full ring-0',
			// Size animation
			'size-6 data-[state=unchecked]:size-4',
			// Colors
			'bg-md3-on-primary data-[state=unchecked]:bg-md3-outline',
			// Position
			'transition-all duration-[var(--md3-duration-short4)] ease-[var(--md3-easing-standard)]',
			'data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-1'
		)}
	/>
</SwitchPrimitive.Root>
