<script lang="ts">
	import { Avatar as AvatarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		loadingStatus = $bindable('loading'),
		class: className,
		...restProps
	}: AvatarPrimitive.RootProps = $props();
</script>

<AvatarPrimitive.Root
	bind:ref
	bind:loadingStatus
	data-slot="avatar"
	class={cn(
		// MD3 Avatar styles
		'relative flex size-10 shrink-0 overflow-hidden rounded-full',
		'bg-md3-surface-container-highest',
		className
	)}
	{...restProps}
/>
