<script lang="ts">
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Spinner } from "$lib/components/ui/spinner";
  import { RefreshCw, Heart, HeartOff } from "@lucide/svelte";

  let healthStatus = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let responseTime = $state<number | null>(null);

  onMount(async () => {
    await checkHealth();
  });

  async function checkHealth() {
    loading = true;
    error = null;
    const startTime = performance.now();

    try {
      const response = await api.health.get();

      if (response.error) {
        error = "Failed to connect to API";
        return;
      }

      responseTime = Math.round(performance.now() - startTime);
      healthStatus = response.data?.status ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Network error";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Health Check | ft_transcendence</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <div class="mx-auto mb-4 p-3 rounded-full bg-muted w-fit">
        {#if loading}
          <Spinner class="size-8" />
        {:else if error}
          <HeartOff class="size-8 text-destructive" />
        {:else}
          <Heart class="size-8 text-emerald-500" />
        {/if}
      </div>
      <Card.Title class="text-2xl">Health Check</Card.Title>
      <Card.Description>
        Testing connection to the ElysiaJS backend via Eden Treaty
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-4">
      <div class="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <span class="text-sm font-medium">Endpoint</span>
        <code class="text-xs bg-background px-2 py-1 rounded">/health</code>
      </div>

      <div class="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <span class="text-sm font-medium">Status</span>
        {#if loading}
          <Badge variant="secondary">Checking...</Badge>
        {:else if error}
          <Badge variant="destructive">Error</Badge>
        {:else}
          <Badge class="bg-emerald-600 hover:bg-emerald-600">{healthStatus}</Badge>
        {/if}
      </div>

      {#if responseTime !== null}
        <div class="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <span class="text-sm font-medium">Response Time</span>
          <span class="font-mono text-sm">{responseTime}ms</span>
        </div>
      {/if}

      {#if error}
        <div class="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <p class="text-sm text-destructive">{error}</p>
        </div>
      {/if}
    </Card.Content>

    <Card.Footer>
      <Button onclick={checkHealth} disabled={loading} class="w-full">
        {#if loading}
          <Spinner class="size-4" />
          Checking...
        {:else}
          <RefreshCw class="size-4" />
          Refresh
        {/if}
      </Button>
    </Card.Footer>
  </Card.Root>
</div>
