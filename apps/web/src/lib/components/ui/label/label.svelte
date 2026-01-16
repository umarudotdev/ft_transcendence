<script lang="ts">
	import { Label as LabelPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn(
		// MD3 Label styles
		"flex items-center gap-2 select-none",
		"md3-body-medium text-md3-on-surface",
		// Disabled states
		"group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-38",
		"peer-disabled:cursor-not-allowed peer-disabled:opacity-38",
		className
	)}
	{...restProps}
/>
