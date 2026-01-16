<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		variant = "default",
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean;
		variant?: "default" | "destructive";
	} = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	data-inset={inset}
	data-variant={variant}
	class={cn(
		// MD3 Menu item styles
		"relative flex cursor-default items-center gap-3 px-3 py-2 outline-hidden select-none",
		// Typography
		"md3-body-large text-md3-on-surface",
		// Hover/highlight states
		"data-highlighted:bg-md3-on-surface/8",
		// Destructive variant
		"data-[variant=destructive]:text-md3-error",
		"data-[variant=destructive]:data-highlighted:bg-md3-error/8",
		"data-[variant=destructive]:*:[svg]:!text-md3-error",
		// Icons
		"[&_svg:not([class*='text-'])]:text-md3-on-surface-variant",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
		// Disabled
		"data-[disabled]:pointer-events-none data-[disabled]:opacity-38",
		// Inset
		"data-[inset]:ps-12",
		className
	)}
	{...restProps}
/>
