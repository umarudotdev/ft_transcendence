<script lang="ts">
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import DropdownMenuPortal from "./dropdown-menu-portal.svelte";
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		sideOffset = 4,
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		class={cn(
			// MD3 Menu styles
			"z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto py-2",
			"max-h-(--bits-dropdown-menu-content-available-height)",
			"origin-(--bits-dropdown-menu-content-transform-origin)",
			// Colors
			"bg-md3-surface-container text-md3-on-surface",
			// Shape
			"rounded-[var(--md3-shape-extra-small)]",
			// Elevation
			"shadow-md",
			// Animation
			"data-[state=open]:animate-in data-[state=closed]:animate-out",
			"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
			"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2",
			"data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2",
			"outline-none",
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
