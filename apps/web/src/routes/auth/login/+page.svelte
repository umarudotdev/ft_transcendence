<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		createLoginMutation,
		createVerify2faLoginMutation,
		redirectTo42OAuth,
		type LoginResponse,
	} from '$lib/queries/auth';

	let email = $state('');
	let password = $state('');
	let code = $state('');
	let errorMessage = $state('');
	let requires2fa = $state(false);

	const loginMutation = createLoginMutation();
	const verify2faMutation = createVerify2faLoginMutation();

	// Check for success messages from registration
	const registeredSuccess = $derived(page.url.searchParams.get('registered') === 'true');
	const verifiedSuccess = $derived(page.url.searchParams.get('verified') === 'true');
	const oauthError = $derived(page.url.searchParams.get('error'));

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		loginMutation.mutate(
			{ email, password },
			{
				onSuccess: (data: LoginResponse) => {
					if (data.requires2fa) {
						requires2fa = true;
					} else {
						goto('/');
					}
				},
				onError: (error: Error) => {
					errorMessage = error.message;
				},
			}
		);
	}

	async function handleVerify2fa(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		verify2faMutation.mutate(
			{ code },
			{
				onSuccess: () => {
					goto('/');
				},
				onError: (error: Error) => {
					errorMessage = error.message;
				},
			}
		);
	}

	function handleBack() {
		requires2fa = false;
		code = '';
		errorMessage = '';
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title class="text-2xl">
				{requires2fa ? 'Two-Factor Authentication' : 'Welcome back'}
			</Card.Title>
			<Card.Description>
				{requires2fa
					? 'Enter the code from your authenticator app'
					: 'Sign in to your account to continue'}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if registeredSuccess}
				<Alert class="mb-4">
					<AlertDescription>
						Account created! Please check your email to verify your account before logging in.
					</AlertDescription>
				</Alert>
			{/if}

			{#if verifiedSuccess}
				<Alert class="mb-4">
					<AlertDescription>
						Email verified! You can now log in to your account.
					</AlertDescription>
				</Alert>
			{/if}

			{#if oauthError}
				<Alert variant="destructive" class="mb-4">
					<AlertDescription>
						OAuth login failed: {oauthError.replace(/_/g, ' ')}
					</AlertDescription>
				</Alert>
			{/if}

			{#if errorMessage}
				<Alert variant="destructive" class="mb-4">
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			{/if}

			{#if requires2fa}
				<form onsubmit={handleVerify2fa} class="space-y-4">
					<div class="space-y-2">
						<Label for="code">Authentication Code</Label>
						<Input
							id="code"
							type="text"
							bind:value={code}
							required
							pattern="[0-9]{6}"
							maxlength={6}
							placeholder="000000"
							class="text-center text-2xl tracking-widest"
						/>
						<p class="text-sm text-muted-foreground">
							Enter the 6-digit code from your authenticator app
						</p>
					</div>

					<Button type="submit" class="w-full" disabled={verify2faMutation.isPending}>
						{verify2faMutation.isPending ? 'Verifying...' : 'Verify'}
					</Button>

					<Button type="button" variant="outline" class="w-full" onclick={handleBack}>
						Back to login
					</Button>
				</form>
			{:else}
				<form onsubmit={handleLogin} class="space-y-4">
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
						<div class="flex items-center justify-between">
							<Label for="password">Password</Label>
							<a href="/auth/forgot-password" class="text-sm text-primary hover:underline">
								Forgot password?
							</a>
						</div>
						<Input id="password" type="password" bind:value={password} required />
					</div>

					<Button type="submit" class="w-full" disabled={loginMutation.isPending}>
						{loginMutation.isPending ? 'Signing in...' : 'Sign in'}
					</Button>
				</form>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t" />
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-background px-2 text-muted-foreground">Or continue with</span>
					</div>
				</div>

				<Button variant="outline" class="w-full" onclick={redirectTo42OAuth}>
					Login with 42
				</Button>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					Don't have an account?
					<a href="/auth/register" class="text-primary hover:underline">Sign up</a>
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
