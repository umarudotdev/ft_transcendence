<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	/**
	 * MD3 Button Variants
	 *
	 * Based on Material Design 3 button specifications:
	 * - Filled: High emphasis, primary actions
	 * - Tonal: Medium emphasis, secondary actions
	 * - Elevated: Medium emphasis with elevation
	 * - Outlined: Medium-low emphasis, alternative actions
	 * - Text: Low emphasis, tertiary actions
	 *
	 * @see https://m3.material.io/components/buttons/overview
	 */
	export const buttonVariants = tv({
		base: [
			// Base styles
			'md3-state-layer relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
			// Typography (MD3 label-large)
			'text-[14px] font-medium leading-5 tracking-normal',
			// Shape (MD3 full rounded for buttons with squircle enhancement)
			'rounded-full corner-squircle',
			// Transition (MD3 motion)
			'transition-all duration-[var(--md3-duration-short4)] ease-[var(--md3-easing-standard)]',
			// Focus state
			'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
			// Disabled state
			'disabled:pointer-events-none disabled:opacity-38',
			'aria-disabled:pointer-events-none aria-disabled:opacity-38',
			// Icon sizing
			"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]"
		],
		variants: {
			variant: {
				// Filled button (default) - Primary actions
				default: ['bg-primary text-primary-foreground', 'hover:shadow-md', 'active:shadow-sm'],
				// Filled Tonal button - Secondary actions
				tonal: ['bg-md3-secondary-container text-md3-on-secondary-container', 'hover:shadow-sm'],
				// Elevated button - Medium emphasis
				elevated: ['bg-md3-surface-container-low text-primary', 'shadow-sm', 'hover:shadow-md'],
				// Outlined button - Alternative actions
				outline: [
					'border border-md3-outline bg-transparent text-primary',
					'hover:bg-md3-primary/8',
					'dark:border-md3-outline dark:hover:bg-md3-primary/12'
				],
				// Text button - Tertiary actions
				ghost: ['text-primary', 'hover:bg-md3-primary/8', 'dark:hover:bg-md3-primary/12'],
				// Link style
				link: 'text-primary underline-offset-4 hover:underline',
				// Destructive (error)
				destructive: [
					'bg-md3-error text-md3-on-error',
					'hover:shadow-md hover:bg-md3-error/90',
					'focus-visible:ring-md3-error/20 dark:focus-visible:ring-md3-error/40'
				],
				// Secondary (legacy alias for tonal)
				secondary: ['bg-md3-secondary-container text-md3-on-secondary-container', 'hover:shadow-sm']
			},
			size: {
				// Standard button heights per MD3
				default: 'h-10 px-6 has-[>svg]:px-4',
				sm: 'h-8 gap-1.5 px-4 text-[12px] has-[>svg]:px-3',
				lg: 'h-12 px-8 text-[16px] has-[>svg]:px-6',
				// Icon buttons
				icon: 'size-10',
				'icon-sm': 'size-8',
				'icon-lg': 'size-12'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
