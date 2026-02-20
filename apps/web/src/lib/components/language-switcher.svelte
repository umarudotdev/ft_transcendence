<script lang="ts">
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import CheckIcon from '@lucide/svelte/icons/check';

	const languages = [
		{ code: 'en', label: 'English' },
		{ code: 'pt-br', label: 'Português (BR)' },
		{ code: 'es', label: 'Español' }
	] as const;

	const currentLocale = $derived(getLocale());
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				class="relative size-10"
				aria-label="Change language"
			>
				<GlobeIcon class="size-5" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		{#each languages as lang}
			<DropdownMenu.Item onclick={() => setLocale(lang.code)}>
				{#if currentLocale === lang.code}
					<CheckIcon class="mr-2 size-4" />
				{:else}
					<span class="mr-2 size-4"></span>
				{/if}
				{lang.label}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
