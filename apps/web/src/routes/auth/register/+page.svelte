<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { createRegisterMutation, redirectTo42OAuth } from '$lib/queries/auth';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let displayName = $state('');
	let errorMessage = $state('');

	const registerMutation = createRegisterMutation();

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

		registerMutation.mutate(
			{ email, password, displayName },
			{
				onSuccess: () => {
					goto('/auth/login?registered=true');
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
			<Card.Title class="text-2xl">Create an account</Card.Title>
			<Card.Description>Enter your details to create a new account</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}

				<div class="space-y-2">
					<Label for="displayName">Display Name</Label>
					<Input
						id="displayName"
						type="text"
						bind:value={displayName}
						required
						minlength={3}
						maxlength={30}
						placeholder="Your display name"
					/>
				</div>

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

				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input id="password" type="password" bind:value={password} required minlength={8} />

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

				<Button type="submit" class="w-full" disabled={registerMutation.isPending}>
					{registerMutation.isPending ? 'Creating account...' : 'Create account'}
				</Button>
			</form>

			<div class="relative my-6">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-background px-2 text-muted-foreground">Or continue with</span>
				</div>
			</div>

			<Button variant="outline" class="w-full" onclick={redirectTo42OAuth}>
				Login with 42
			</Button>

			<p class="mt-4 text-center text-sm text-muted-foreground">
				Already have an account?
				<a href="/auth/login" class="text-primary hover:underline">Sign in</a>
			</p>
		</Card.Content>
	</Card.Root>
</div>
