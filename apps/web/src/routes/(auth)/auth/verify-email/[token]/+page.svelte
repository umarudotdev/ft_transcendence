<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createVerifyEmailMutation } from '$lib/queries/auth';
	import { onMount } from 'svelte';

	let errorMessage = $state('');
	let isVerifying = $state(true);
	let success = $state(false);

	const verifyMutation = createVerifyEmailMutation();

	onMount(async () => {
		const token = page.params.token;

		if (!token) {
			errorMessage = 'Invalid verification link';
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

<Card.Root class="w-full max-w-md">
	<Card.Header>
		<Card.Title class="text-2xl">Email Verification</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if isVerifying}
			<div class="py-4 text-center">
				<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p>Verifying your email...</p>
			</div>
		{:else if success}
			<Alert class="mb-4">
				<AlertDescription>
					Your email has been verified successfully! You can now log in to your account.
				</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto('/auth/login?verified=true')}>Go to Login</Button>
		{:else}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription>{errorMessage}</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto('/auth/login')}>Go to Login</Button>
		{/if}
	</Card.Content>
</Card.Root>
