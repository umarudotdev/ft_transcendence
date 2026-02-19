<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	/**
	 * MD3 Badge Variants
	 *
	 * Based on Material Design 3 badge/chip specifications.
	 * @see https://m3.material.io/components/badges/overview
	 */
	export const badgeVariants = tv({
		base: [
			// Layout
			'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden',
			// Shape (MD3 small for badges)
			'rounded-[var(--md3-shape-small)] px-2 py-0.5',
			// Typography (MD3 label-small)
			'md3-label-small',
			// Transition
			'transition-all duration-[var(--md3-duration-short2)] ease-[var(--md3-easing-standard)]',
			// Focus
			'focus-visible:ring-[3px] focus-visible:ring-ring/50',
			// Icons
			'[&>svg]:pointer-events-none [&>svg]:size-3'
		],
		variants: {
			variant: {
				default: ['bg-md3-primary text-md3-on-primary', '[a&]:hover:bg-md3-primary/90'],
				secondary: [
					'bg-md3-secondary-container text-md3-on-secondary-container',
					'[a&]:hover:bg-md3-secondary-container/90'
				],
				destructive: [
					'bg-md3-error text-md3-on-error',
					'[a&]:hover:bg-md3-error/90',
					'focus-visible:ring-md3-error/20 dark:focus-visible:ring-md3-error/40'
				],
				outline: [
					'border border-md3-outline text-md3-on-surface',
					'[a&]:hover:bg-md3-surface-variant'
				]
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
