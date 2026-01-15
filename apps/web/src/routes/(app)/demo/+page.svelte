<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight">Demo Pages</h1>
		<p class="text-muted-foreground">Examples and testing pages</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Available Demos</Card.Title>
			<Card.Description>Explore the demo pages</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-2">
				<Button variant="outline" href="/demo/paraglide" class="w-full justify-start">
					Paraglide i18n Demo
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>
