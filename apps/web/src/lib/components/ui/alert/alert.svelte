<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	/**
	 * MD3 Alert Variants
	 *
	 * Based on Material Design 3 banner/snackbar patterns.
	 */
	export const alertVariants = tv({
		base: [
			// Layout
			'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 px-4 py-3',
			// Shape
			'rounded-[var(--md3-shape-medium)]',
			// Typography
			'md3-body-medium',
			// Icon grid
			'has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3',
			'[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current'
		],
		variants: {
			variant: {
				default: [
					'bg-md3-surface-container text-md3-on-surface',
					'border border-md3-outline-variant'
				],
				destructive: [
					'bg-md3-error-container text-md3-on-error-container',
					'*:data-[slot=alert-description]:text-md3-on-error-container/90',
					'[&>svg]:text-md3-error'
				]
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type AlertVariant = VariantProps<typeof alertVariants>['variant'];
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: AlertVariant;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	class={cn(alertVariants({ variant }), className)}
	{...restProps}
	role="alert"
>
	{@render children?.()}
</div>
