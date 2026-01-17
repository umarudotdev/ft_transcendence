<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Spinner } from '$lib/components/ui/spinner';
	import { ShieldCheck, CircleAlert, CircleCheck, RefreshCw } from '@lucide/svelte';

	let status = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastChecked = $state<Date | null>(null);

	onMount(async () => {
		await checkStatus();
	});

	async function checkStatus() {
		loading = true;
		error = null;

		try {
			const response = await api.api.status.get();

			if (response.error) {
				error = 'Failed to connect to API';
				return;
			}

			status = response.data?.status ?? null;
			lastChecked = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Network error';
		} finally {
			loading = false;
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>System Status | ft_transcendence</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background">
	<div
		class="absolute inset-0 opacity-[0.02]"
		style="background-image: linear-gradient(var(--foreground) 1px, transparent 1px),
           linear-gradient(90deg, var(--foreground) 1px, transparent 1px);
           background-size: 32px 32px;"
	></div>

	<div
		class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
		class:bg-emerald-500={status && !error}
		class:bg-destructive={error}
		class:bg-muted={loading}
	></div>

	<div class="relative container mx-auto max-w-2xl px-4 py-16">
		<header class="mb-12 space-y-4 text-center">
			<div
				class="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 backdrop-blur-sm"
			>
				<span class="relative flex h-2 w-2">
					{#if loading}
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
					{:else if error}
						<span class="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
					{:else}
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
					{/if}
				</span>
				<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
					{#if loading}
						Checking
					{:else if error}
						Degraded
					{:else}
						Operational
					{/if}
				</span>
			</div>

			<h1 class="text-4xl font-bold tracking-tight">System Status</h1>
			<p class="mx-auto max-w-md text-muted-foreground">
				Real-time health monitoring for ft_transcendence services
			</p>
		</header>

		<Card.Root class="overflow-hidden border-2 shadow-lg">
			<Card.Header class="pb-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-lg bg-muted p-2">
							<ShieldCheck class="size-5" />
						</div>
						<div>
							<Card.Title class="text-lg">API Server</Card.Title>
							<Card.Description>ElysiaJS Backend Service</Card.Description>
						</div>
					</div>
					<Badge
						variant={loading ? 'secondary' : error ? 'destructive' : 'default'}
						class={!loading && !error ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
					>
						{#if loading}
							Checking...
						{:else if error}
							Offline
						{:else}
							Online
						{/if}
					</Badge>
				</div>
			</Card.Header>

			<Card.Content class="space-y-4">
				{#if loading}
					<div class="flex items-center justify-center gap-3 py-8">
						<Spinner class="size-5 text-muted-foreground" />
						<span class="text-muted-foreground">Checking API status...</span>
					</div>
				{:else if error}
					<Alert.Root variant="destructive">
						<CircleAlert class="size-4" />
						<Alert.Title>Connection Failed</Alert.Title>
						<Alert.Description>
							{error}
						</Alert.Description>
					</Alert.Root>
				{:else if status}
					<Alert.Root
						class="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50"
					>
						<CircleCheck class="size-4 text-emerald-600 dark:text-emerald-400" />
						<Alert.Title class="text-emerald-800 dark:text-emerald-200">
							All Systems Operational
						</Alert.Title>
						<Alert.Description class="text-emerald-700 dark:text-emerald-300">
							API Status: <span class="font-mono font-semibold">{status}</span> — Eden Treaty connection
							verified
						</Alert.Description>
					</Alert.Root>
				{/if}

				{#if !loading}
					<div class="border-t pt-4">
						<dl class="grid grid-cols-2 gap-4 text-sm">
							<div>
								<dt class="text-muted-foreground">Protocol</dt>
								<dd class="font-mono font-medium">HTTP/REST</dd>
							</div>
							<div>
								<dt class="text-muted-foreground">Client</dt>
								<dd class="font-mono font-medium">Eden Treaty</dd>
							</div>
							<div>
								<dt class="text-muted-foreground">Endpoint</dt>
								<dd class="font-mono text-xs font-medium">/status</dd>
							</div>
							<div>
								<dt class="text-muted-foreground">Last Check</dt>
								<dd class="font-mono font-medium">
									{lastChecked ? formatTime(lastChecked) : '—'}
								</dd>
							</div>
						</dl>
					</div>
				{/if}
			</Card.Content>

			<Card.Footer class="border-t bg-muted/30">
				<Button onclick={checkStatus} disabled={loading} class="w-full" variant="outline">
					{#if loading}
						<Spinner class="size-4" />
						Checking...
					{:else}
						<RefreshCw class="size-4" />
						Refresh Status
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>

		<p class="mt-8 text-center text-xs text-muted-foreground">
			Automatic health checks run every 30 seconds in production
		</p>
	</div>
</div>
