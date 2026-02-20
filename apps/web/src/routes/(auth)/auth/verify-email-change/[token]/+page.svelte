<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createVerifyEmailChangeMutation } from '$lib/queries/auth';
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';

	let errorMessage = $state('');
	let isVerifying = $state(true);
	let success = $state(false);

	const verifyMutation = createVerifyEmailChangeMutation();

	onMount(async () => {
		const token = page.params.token;

		if (!token) {
			errorMessage = m.auth_verify_invalid_link();
			isVerifying = false;
			return;
		}

		verifyMutation.mutate(token, {
			onSuccess: () => {
				success = true;
				isVerifying = false;
			},
			onError: (error: Error) => {
				errorMessage = error.message;
				isVerifying = false;
			}
		});
	});
</script>

<Card.Root class="w-full max-w-md border-y">
	<Card.Header>
		<Card.Title class="text-2xl">{m.auth_verify_change_title()}</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if isVerifying}
			<div class="py-4 text-center">
				<div class="mx-auto mb-4 size-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p>{m.auth_verify_change_verifying()}</p>
			</div>
		{:else if success}
			<Alert class="mb-4">
				<AlertDescription>
					{m.auth_verify_change_success()}
				</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto('/auth/login?email_changed=true')}>
				{m.auth_verify_go_to_login()}
			</Button>
		{:else}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription>{errorMessage}</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto('/auth/login')}>{m.auth_verify_go_to_login()}</Button>
		{/if}
	</Card.Content>
</Card.Root>
