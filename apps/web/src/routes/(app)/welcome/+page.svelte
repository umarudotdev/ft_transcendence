<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { createMeQuery } from "$lib/queries/auth";
	import PartyPopperIcon from "@lucide/svelte/icons/party-popper";
	import GamepadIcon from "@lucide/svelte/icons/gamepad-2";
	import UserIcon from "@lucide/svelte/icons/user";
	import SettingsIcon from "@lucide/svelte/icons/settings";

	const meQuery = createMeQuery();
</script>

<svelte:head>
	<title>Welcome | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-8">
	<div class="text-center">
		<div class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
			<PartyPopperIcon class="size-10 text-primary" />
		</div>
		<h1 class="text-4xl font-bold tracking-tight">Welcome to ft_transcendence!</h1>
		{#if meQuery.data}
			<p class="mt-2 text-xl text-muted-foreground">
				Great to have you here, {meQuery.data.displayName}!
			</p>
		{:else}
			<p class="mt-2 text-xl text-muted-foreground">Great to have you here!</p>
		{/if}
	</div>

	<Card.Root class="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
		<Card.Content class="pt-6">
			<div class="space-y-4 text-center">
				<h2 class="text-2xl font-semibold">What is ft_transcendence?</h2>
				<p class="text-muted-foreground">
					ft_transcendence is a real-time multiplayer Pong platform. Challenge other players, climb
					the leaderboard, earn achievements, and chat with the community.
				</p>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Root class="text-center">
			<Card.Content class="pt-6">
				<div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
					<UserIcon class="size-6 text-primary" />
				</div>
				<h3 class="font-semibold">Set Up Profile</h3>
				<p class="mt-1 text-sm text-muted-foreground">Customize your avatar and display name</p>
				<Button href="/settings" variant="outline" class="mt-4 w-full gap-2">
					<SettingsIcon class="size-4" />
					Settings
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root class="text-center">
			<Card.Content class="pt-6">
				<div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
					<GamepadIcon class="size-6 text-primary" />
				</div>
				<h3 class="font-semibold">Start Playing</h3>
				<p class="mt-1 text-sm text-muted-foreground">Jump into your first match</p>
				<Button href="/" class="mt-4 w-full gap-2">
					<GamepadIcon class="size-4" />
					Game Lobby
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root class="text-center">
			<Card.Content class="pt-6">
				<div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
					<svg class="size-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
						<circle cx="9" cy="7" r="4" />
						<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
						<path d="M16 3.13a4 4 0 0 1 0 7.75" />
					</svg>
				</div>
				<h3 class="font-semibold">Find Players</h3>
				<p class="mt-1 text-sm text-muted-foreground">Browse the leaderboard</p>
				<Button href="/leaderboard" variant="outline" class="mt-4 w-full">Leaderboard</Button>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="text-center">
		<Button href="/" size="lg" class="gap-2">
			<GamepadIcon class="size-5" />
			Go to Game Lobby
		</Button>
	</div>
</div>
