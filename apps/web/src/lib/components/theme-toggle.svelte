<script lang="ts">
	import { setMode, resetMode } from "mode-watcher";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Button } from "$lib/components/ui/button";
	import SunIcon from "@lucide/svelte/icons/sun";
	import MoonIcon from "@lucide/svelte/icons/moon";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="size-8">
				<SunIcon class="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<MoonIcon class="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				<span class="sr-only">Toggle theme</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={() => setMode("light")}>
			<SunIcon class="mr-2 size-4" />
			Light
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setMode("dark")}>
			<MoonIcon class="mr-2 size-4" />
			Dark
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => resetMode()}>
			<MonitorIcon class="mr-2 size-4" />
			System
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
