<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { createVerifyEmailChangeMutation } from "$lib/queries/auth";
	import { onMount } from "svelte";

	let errorMessage = $state("");
	let isVerifying = $state(true);
	let success = $state(false);

	const verifyMutation = createVerifyEmailChangeMutation();

	onMount(async () => {
		const token = page.params.token;

		if (!token) {
			errorMessage = "Invalid verification link";
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
			},
		});
	});
</script>

<Card.Root class="w-full max-w-md">
	<Card.Header>
		<Card.Title class="text-2xl">Email Change Verification</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if isVerifying}
			<div class="py-4 text-center">
				<div
					class="mx-auto mb-4 size-8 animate-spin rounded-full border-b-2 border-primary"
				></div>
				<p>Verifying your new email address...</p>
			</div>
		{:else if success}
			<Alert class="mb-4">
				<AlertDescription>
					Your email has been changed successfully! You have been logged out of all devices. Please
					log in with your new email address.
				</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto("/auth/login?email_changed=true")}>
				Go to Login
			</Button>
		{:else}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription>{errorMessage}</AlertDescription>
			</Alert>
			<Button class="w-full" onclick={() => goto("/auth/login")}>Go to Login</Button>
		{/if}
	</Card.Content>
</Card.Root>
