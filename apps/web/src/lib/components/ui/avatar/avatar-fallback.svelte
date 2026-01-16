<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AvatarPrimitive.FallbackProps = $props();
</script>

<AvatarPrimitive.Fallback
	bind:ref
	data-slot="avatar-fallback"
	class={cn(
		// MD3 Avatar fallback styles
		"flex size-full items-center justify-center rounded-full",
		"bg-md3-primary-container text-md3-on-primary-container",
		"md3-title-medium",
		className
	)}
	{...restProps}
/>
