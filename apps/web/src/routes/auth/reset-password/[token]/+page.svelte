<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createResetPasswordMutation } from '$lib/queries/auth';

	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let success = $state(false);

	const resetMutation = createResetPasswordMutation();

	// Password requirements state
	const passwordRequirements = $derived({
		minLength: password.length >= 8,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasNumber: /[0-9]/.test(password),
	});

	const isPasswordValid = $derived(
		passwordRequirements.minLength &&
			passwordRequirements.hasUppercase &&
			passwordRequirements.hasLowercase &&
			passwordRequirements.hasNumber
	);

	const passwordsMatch = $derived(password === confirmPassword && password.length > 0);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (!isPasswordValid) {
			errorMessage = 'Please meet all password requirements';
			return;
		}

		if (!passwordsMatch) {
			errorMessage = 'Passwords do not match';
			return;
		}

		const token = page.params.token;
		if (!token) {
			errorMessage = 'Invalid reset link';
			return;
		}

		resetMutation.mutate(
			{ token, password },
			{
				onSuccess: () => {
					success = true;
				},
				onError: (error: Error) => {
					errorMessage = error.message;
				},
			}
		);
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title class="text-2xl">Reset Password</Card.Title>
			<Card.Description>Enter your new password below</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if success}
				<Alert class="mb-4">
					<AlertDescription>
						Your password has been reset successfully! You can now log in with your new password.
					</AlertDescription>
				</Alert>
				<Button class="w-full" onclick={() => goto('/auth/login')}>
					Go to Login
				</Button>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if errorMessage}
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					{/if}

					<div class="space-y-2">
						<Label for="password">New Password</Label>
						<Input id="password" type="password" bind:value={password} required minlength={8} />

						<!-- Password strength indicator -->
						<div class="text-sm space-y-1 mt-2">
							<p class="font-medium">Password requirements:</p>
							<ul class="list-inside list-disc text-muted-foreground">
								<li class:text-green-600={passwordRequirements.minLength}>At least 8 characters</li>
								<li class:text-green-600={passwordRequirements.hasUppercase}>
									At least 1 uppercase letter
								</li>
								<li class:text-green-600={passwordRequirements.hasLowercase}>
									At least 1 lowercase letter
								</li>
								<li class:text-green-600={passwordRequirements.hasNumber}>At least 1 number</li>
							</ul>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">Confirm Password</Label>
						<Input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							required
							minlength={8}
						/>
						{#if confirmPassword && !passwordsMatch}
							<p class="text-sm text-destructive">Passwords do not match</p>
						{/if}
					</div>

					<Button type="submit" class="w-full" disabled={resetMutation.isPending}>
						{resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
					</Button>
				</form>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					<a href="/auth/login" class="text-primary hover:underline">Back to Login</a>
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
