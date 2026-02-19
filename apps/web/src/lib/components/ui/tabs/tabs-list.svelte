<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	class={cn(
		// MD3 Tab bar styles
		'inline-flex h-12 w-fit items-center justify-center gap-0',
		'bg-md3-surface text-md3-on-surface-variant',
		'border-b border-md3-surface-variant',
		className
	)}
	{...restProps}
/>
