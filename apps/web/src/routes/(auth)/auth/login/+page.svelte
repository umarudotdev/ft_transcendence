<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		createLoginMutation,
		createVerify2faLoginMutation,
		redirectTo42OAuth,
		type LoginResponse
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

	// User-friendly OAuth error messages
	const oauthErrorMessages: Record<string, string> = {
		invalid_oauth: 'Invalid OAuth response. Please try again.',
		invalid_state: 'Security check failed. Please try again.',
		token_exchange_failed: 'Unable to complete authentication. Please try again.',
		profile_fetch_failed: 'Unable to fetch your profile. Please try again.',
		account_already_linked: 'This 42 account is already linked to another user.'
	};

	const friendlyOAuthError = $derived(
		oauthError
			? oauthErrorMessages[oauthError] || `Authentication error: ${oauthError.replace(/_/g, ' ')}`
			: null
	);

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
				}
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
				}
			}
		);
	}

	function handleBack() {
		requires2fa = false;
		code = '';
		errorMessage = '';
	}
</script>

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
				<AlertDescription>Email verified! You can now log in to your account.</AlertDescription>
			</Alert>
		{/if}

		{#if friendlyOAuthError}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription class="flex flex-col gap-2">
					<span>{friendlyOAuthError}</span>
					<Button
						variant="outline"
						size="sm"
						class="w-fit"
						onclick={() => {
							// Clear the error and redirect to OAuth
							window.history.replaceState({}, '', '/auth/login');
							redirectTo42OAuth();
						}}
					>
						Try again with 42
					</Button>
				</AlertDescription>
			</Alert>
		{/if}

		{#if errorMessage}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription>{errorMessage}</AlertDescription>
			</Alert>
		{/if}

		{#if requires2fa}
			<form onsubmit={handleVerify2fa} class="space-y-6">
				<div class="space-y-3">
					<Label for="code">Authentication Code</Label>
					<InputOTP.Root
						maxlength={6}
						bind:value={code}
						onComplete={() => {
							// Auto-submit when complete
						}}
					>
						{#snippet children({ cells })}
							<InputOTP.Group>
								{#each cells.slice(0, 3) as cell (cell)}
									<InputOTP.Slot {cell} />
								{/each}
							</InputOTP.Group>
							<InputOTP.Separator />
							<InputOTP.Group>
								{#each cells.slice(3, 6) as cell (cell)}
									<InputOTP.Slot {cell} />
								{/each}
							</InputOTP.Group>
						{/snippet}
					</InputOTP.Root>
					<p class="text-sm text-md3-on-surface-variant">
						Enter the 6-digit code from your authenticator app
					</p>
				</div>

				<Button
					type="submit"
					class="w-full"
					disabled={code.length !== 6 || verify2faMutation.isPending}
				>
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
					<span class="w-full border-t"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-background px-2 text-muted-foreground">Or continue with</span>
				</div>
			</div>

			<Button variant="outline" class="w-full" onclick={redirectTo42OAuth}>Login with 42</Button>

			<p class="mt-4 text-center text-sm text-muted-foreground">
				Don't have an account?
				<a href="/auth/register" class="text-primary hover:underline">Sign up</a>
			</p>
		{/if}
	</Card.Content>
</Card.Root>
