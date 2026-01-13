<script lang="ts">
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Spinner } from "$lib/components/ui/spinner";
  import {
    ShieldCheck,
    CircleAlert,
    CircleCheck,
    RefreshCw,
  } from "@lucide/svelte";

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
      const response = await api.status.get();

      if (response.error) {
        error = "Failed to connect to API";
        return;
      }

      status = response.data?.status ?? null;
      lastChecked = new Date();
    } catch (e) {
      error = e instanceof Error ? e.message : "Network error";
    } finally {
      loading = false;
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

<svelte:head>
  <title>System Status | ft_transcendence</title>
</svelte:head>

<div class="min-h-screen bg-background relative overflow-hidden">
  <!-- Decorative background grid -->
  <div
    class="absolute inset-0 opacity-[0.02]"
    style="background-image: linear-gradient(var(--foreground) 1px, transparent 1px),
           linear-gradient(90deg, var(--foreground) 1px, transparent 1px);
           background-size: 32px 32px;"
  ></div>

  <!-- Decorative orbs -->
  <div
    class="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
    class:bg-emerald-500={status && !error}
    class:bg-destructive={error}
    class:bg-muted={loading}
  ></div>

  <div class="relative container mx-auto px-4 py-16 max-w-2xl">
    <!-- Header -->
    <header class="text-center mb-12 space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-card/50 backdrop-blur-sm">
        <span class="relative flex h-2 w-2">
          {#if loading}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          {:else if error}
            <span class="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          {:else}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          {/if}
        </span>
        <span class="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {#if loading}
            Checking
          {:else if error}
            Degraded
          {:else}
            Operational
          {/if}
        </span>
      </div>

      <h1 class="text-4xl font-bold tracking-tight">
        System Status
      </h1>
      <p class="text-muted-foreground max-w-md mx-auto">
        Real-time health monitoring for ft_transcendence services
      </p>
    </header>

    <!-- Main status card -->
    <Card.Root class="border-2 shadow-lg overflow-hidden">
      <Card.Header class="pb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-muted">
              <ShieldCheck class="size-5" />
            </div>
            <div>
              <Card.Title class="text-lg">API Server</Card.Title>
              <Card.Description>ElysiaJS Backend Service</Card.Description>
            </div>
          </div>
          <Badge
            variant={loading ? "secondary" : error ? "destructive" : "default"}
            class={!loading && !error ? "bg-emerald-600 hover:bg-emerald-600" : ""}
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
          <div class="flex items-center justify-center py-8 gap-3">
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
          <Alert.Root class="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50">
            <CircleCheck class="size-4 text-emerald-600 dark:text-emerald-400" />
            <Alert.Title class="text-emerald-800 dark:text-emerald-200">
              All Systems Operational
            </Alert.Title>
            <Alert.Description class="text-emerald-700 dark:text-emerald-300">
              API Status: <span class="font-mono font-semibold">{status}</span> — Eden Treaty connection verified
            </Alert.Description>
          </Alert.Root>
        {/if}

        <!-- Status details -->
        {#if !loading}
          <div class="pt-4 border-t">
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
                <dd class="font-mono font-medium text-xs">/status</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Last Check</dt>
                <dd class="font-mono font-medium">
                  {lastChecked ? formatTime(lastChecked) : "—"}
                </dd>
              </div>
            </dl>
          </div>
        {/if}
      </Card.Content>

      <Card.Footer class="bg-muted/30 border-t">
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

    <!-- Footer note -->
    <p class="text-center text-xs text-muted-foreground mt-8">
      Automatic health checks run every 30 seconds in production
    </p>
  </div>
</div>
