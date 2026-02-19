<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { PasswordInput } from '$lib/components/ui/input';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { toast } from 'svelte-sonner';
	import { slide, fade } from 'svelte/transition';
	import {
		createLoginMutation,
		createVerify2faLoginMutation,
		redirectTo42OAuth,
		type LoginResponse
	} from '$lib/queries/auth';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

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

	// User-friendly error messages
	const errorMessages: Record<string, string> = {
		invalid_oauth: 'Invalid OAuth response. Please try again.',
		invalid_state: 'Security check failed. Please try again.',
		token_exchange_failed: 'Unable to complete authentication. Please try again.',
		profile_fetch_failed: 'Unable to fetch your profile. Please try again.',
		account_already_linked: 'This 42 account is already linked to another user.',
		// API error mappings
		'Invalid credentials': 'Email or password is incorrect. Please try again.',
		'Email not verified': 'Please verify your email before signing in.',
		'Account locked': 'Too many failed attempts. Please try again later.',
		'Invalid 2FA code': 'Incorrect code. Please check your authenticator app and try again.'
	};

	const friendlyOAuthError = $derived(
		oauthError
			? errorMessages[oauthError] || `Authentication error: ${oauthError.replace(/_/g, ' ')}`
			: null
	);

	function getFriendlyError(error: string): string {
		return errorMessages[error] || error;
	}

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
						toast.success('Welcome back!');
						goto('/');
					}
				},
				onError: (error: Error) => {
					errorMessage = getFriendlyError(error.message);
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
					toast.success('Successfully authenticated!');
					goto('/');
				},
				onError: (error: Error) => {
					errorMessage = getFriendlyError(error.message);
					code = '';
				}
			}
		);
	}

	function handleBack() {
		requires2fa = false;
		code = '';
		errorMessage = '';
	}

	// Auto-submit when OTP is complete
	function handleOtpComplete() {
		if (code.length === 6 && !verify2faMutation.isPending) {
			handleVerify2fa(new SubmitEvent('submit'));
		}
	}
</script>

<Card.Root class="w-full max-w-md border-y">
	<Card.Header class="text-center">
		{#if requires2fa}
			<div class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10">
				<ShieldCheckIcon class="size-7 text-primary" />
			</div>
		{/if}
		<Card.Title class="text-2xl">
			{requires2fa ? 'Two-Factor Authentication' : 'Welcome back'}
		</Card.Title>
		<Card.Description>
			{requires2fa
				? 'Enter the 6-digit code from your authenticator app'
				: 'Sign in to your account to continue'}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if registeredSuccess || verifiedSuccess}
			<div transition:fade={{ duration: 200 }}>
				<Alert
					class="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
				>
					<CheckCircleIcon class="size-4" />
					<AlertDescription>
						{registeredSuccess
							? 'Account created! Check your email to verify before signing in.'
							: 'Email verified! You can now sign in.'}
					</AlertDescription>
				</Alert>
			</div>
		{/if}

		{#if friendlyOAuthError}
			<div transition:fade={{ duration: 200 }}>
				<Alert variant="destructive" class="mb-4">
					<AlertTriangleIcon class="size-4" />
					<AlertDescription class="flex flex-col gap-2">
						<span>{friendlyOAuthError}</span>
						<Button
							variant="outline"
							size="sm"
							class="w-fit"
							onclick={() => {
								window.history.replaceState({}, '', '/auth/login');
								redirectTo42OAuth();
							}}
						>
							Try again with 42
						</Button>
					</AlertDescription>
				</Alert>
			</div>
		{/if}

		{#if errorMessage}
			<div transition:slide={{ duration: 200 }}>
				<Alert variant="destructive" class="mb-4">
					<AlertTriangleIcon class="size-4" />
					<AlertDescription>
						{errorMessage}
						{#if errorMessage.includes('verify your email')}
							<a href="/auth/resend-verification" class="ml-1 underline hover:no-underline">
								Resend verification email
							</a>
						{/if}
					</AlertDescription>
				</Alert>
			</div>
		{/if}

		{#if requires2fa}
			<div transition:slide={{ duration: 300 }}>
				<form onsubmit={handleVerify2fa} class="space-y-6">
					<div class="flex justify-center">
						<InputOTP.Root
							maxlength={6}
							bind:value={code}
							onComplete={handleOtpComplete}
							disabled={verify2faMutation.isPending}
						>
							{#snippet children({ cells })}
								<InputOTP.Group>
									{#each cells.slice(0, 3) as cell (cell)}
										<InputOTP.Slot {cell} class="size-12 text-lg transition-all duration-200" />
									{/each}
								</InputOTP.Group>
								<InputOTP.Separator />
								<InputOTP.Group>
									{#each cells.slice(3, 6) as cell (cell)}
										<InputOTP.Slot {cell} class="size-12 text-lg transition-all duration-200" />
									{/each}
								</InputOTP.Group>
							{/snippet}
						</InputOTP.Root>
					</div>

					<div class="space-y-3">
						<Button
							type="submit"
							class="w-full"
							disabled={code.length !== 6 || verify2faMutation.isPending}
						>
							{verify2faMutation.isPending ? 'Verifying...' : 'Verify code'}
						</Button>

						<Button type="button" variant="ghost" class="w-full gap-2" onclick={handleBack}>
							<ArrowLeftIcon class="size-4" />
							Back to login
						</Button>
					</div>
				</form>
			</div>
		{:else}
			<div transition:fade={{ duration: 200 }}>
				<form onsubmit={handleLogin} class="space-y-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
							disabled={loginMutation.isPending}
						/>
					</div>

					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="password">Password</Label>
							<a href="/auth/forgot-password" class="text-sm text-primary hover:underline">
								Forgot password?
							</a>
						</div>
						<PasswordInput
							id="password"
							bind:value={password}
							required
							disabled={loginMutation.isPending}
						/>
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
						<span class="bg-card px-2 text-muted-foreground">Or continue with</span>
					</div>
				</div>

				<Button
					variant="outline"
					class="w-full"
					onclick={redirectTo42OAuth}
					disabled={loginMutation.isPending}
				>
					Sign in with 42
				</Button>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					Don't have an account?
					<a href="/auth/register" class="text-primary hover:underline">Sign up</a>
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
