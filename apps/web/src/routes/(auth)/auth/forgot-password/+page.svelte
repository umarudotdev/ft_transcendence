<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createForgotPasswordMutation } from '$lib/queries/auth';
	import { m } from '$lib/paraglide/messages.js';

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
				}
			}
		);
	}
</script>

<Card.Root class="w-full max-w-md border-y">
	<Card.Header>
		<Card.Title class="text-2xl">{m.auth_forgot_title()}</Card.Title>
		<Card.Description>
			{m.auth_forgot_description()}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if success}
			<Alert class="mb-4">
				<AlertDescription>
					{m.auth_forgot_success()}
				</AlertDescription>
			</Alert>
			<Button class="w-full" variant="outline" href="/auth/login">{m.auth_forgot_back_to_login()}</Button>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}

				<div class="space-y-2">
					<Label for="email">{m.common_email()}</Label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						required
						placeholder="you@example.com"
					/>
				</div>

				<Button type="submit" class="w-full" disabled={forgotPasswordMutation.isPending}>
					{forgotPasswordMutation.isPending ? m.auth_forgot_sending() : m.auth_forgot_send()}
				</Button>
			</form>

			<p class="mt-4 text-center text-sm text-muted-foreground">
				{m.auth_forgot_remember()}
				<a href="/auth/login" class="text-primary hover:underline">{m.common_sign_in()}</a>
			</p>
		{/if}
	</Card.Content>
</Card.Root>
