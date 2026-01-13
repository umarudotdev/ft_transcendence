<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createForgotPasswordMutation } from '$lib/queries/auth';

	let email = $state('');
	let success = $state(false);
	let errorMessage = $state('');

	const forgotPasswordMutation = createForgotPasswordMutation();

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		forgotPasswordMutation.mutate(
			{ email },
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
			<Card.Title class="text-2xl">Forgot Password</Card.Title>
			<Card.Description>
				Enter your email and we'll send you a link to reset your password
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if success}
				<Alert class="mb-4">
					<AlertDescription>
						If an account with that email exists, we've sent you a password reset link. Please
						check your inbox.
					</AlertDescription>
				</Alert>
				<Button class="w-full" variant="outline" href="/auth/login">
					Back to Login
				</Button>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if errorMessage}
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					{/if}

					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
						/>
					</div>

					<Button type="submit" class="w-full" disabled={forgotPasswordMutation.isPending}>
						{forgotPasswordMutation.isPending ? 'Sending...' : 'Send Reset Link'}
					</Button>
				</form>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					Remember your password?
					<a href="/auth/login" class="text-primary hover:underline">Sign in</a>
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
