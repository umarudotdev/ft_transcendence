<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { setLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
</script>

<div class="mx-auto max-w-2xl">
	<a
		href="/demo"
		class="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to Demos
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title>Paraglide i18n Demo</Card.Title>
			<Card.Description>Test internationalization with Paraglide</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div>
				<h2 class="text-xl font-semibold">{m.hello_world({ name: 'SvelteKit User' })}</h2>
			</div>

			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => setLocale('en')}>English</Button>
				<Button variant="outline" size="sm" onclick={() => setLocale('ja')}>Japanese</Button>
				<Button variant="outline" size="sm" onclick={() => setLocale('pt-br')}>
					Portuguese (BR)
				</Button>
			</div>

			<p class="text-sm text-muted-foreground">
				If you use VSCode, install the
				<a
					href="https://marketplace.visualstudio.com/items?itemName=inlang.vs-code-extension"
					target="_blank"
					rel="noopener"
					class="text-primary underline hover:no-underline"
				>
					Sherlock i18n extension
				</a>
				for a better i18n experience.
			</p>
		</Card.Content>
	</Card.Root>
</div>
