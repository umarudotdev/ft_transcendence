<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { PasswordInput } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { toast } from 'svelte-sonner';
	import { slide, fade } from 'svelte/transition';
	import { createRegisterMutation, redirectTo42OAuth } from '$lib/queries/auth';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	// Form state
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let displayName = $state('');
	let username = $state('');
	let errorMessage = $state('');

	// Multi-step wizard state
	let currentStep = $state(1);

	const registerMutation = createRegisterMutation();

	// Password requirements state
	const passwordRequirements = $derived({
		minLength: password.length >= 8,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasNumber: /[0-9]/.test(password)
	});

	const isPasswordValid = $derived(
		passwordRequirements.minLength &&
			passwordRequirements.hasUppercase &&
			passwordRequirements.hasLowercase &&
			passwordRequirements.hasNumber
	);

	const passwordsMatch = $derived(password === confirmPassword && password.length > 0);

	// Username requirements
	const usernameRequirements = $derived({
		minLength: username.length >= 3,
		maxLength: username.length <= 20,
		validChars: /^[a-z0-9_]*$/.test(username)
	});

	const isUsernameValid = $derived(
		usernameRequirements.minLength &&
			usernameRequirements.maxLength &&
			usernameRequirements.validChars
	);

	// Condensed password requirements text (only show unmet)
	const unmetPasswordReqs = $derived(() => {
		const unmet: string[] = [];
		if (!passwordRequirements.minLength) unmet.push('8+ characters');
		if (!passwordRequirements.hasUppercase) unmet.push('uppercase');
		if (!passwordRequirements.hasLowercase) unmet.push('lowercase');
		if (!passwordRequirements.hasNumber) unmet.push('number');
		return unmet;
	});

	// Username error message (show first failing requirement)
	const usernameError = $derived(() => {
		if (username.length === 0) return null;
		if (!usernameRequirements.minLength) return 'Username must be at least 3 characters';
		if (!usernameRequirements.maxLength) return 'Username must be at most 20 characters';
		if (!usernameRequirements.validChars) return 'Only lowercase letters, numbers, and underscores allowed';
		return null;
	});

	// Step validation
	const isStep1Valid = $derived(
		email.length > 0 && isPasswordValid && passwordsMatch
	);

	const isStep2Valid = $derived(
		displayName.length > 0 &&
			usernameRequirements.minLength &&
			usernameRequirements.maxLength &&
			usernameRequirements.validChars
	);

	// User-friendly error messages
	const errorMessages: Record<string, string> = {
		'Email already exists': 'An account with this email already exists. Try signing in instead.',
		'Username already exists': 'This username is taken. Please choose another one.',
		'Invalid email': 'Please enter a valid email address.',
		'Weak password': 'Please choose a stronger password.',
		'Email already registered': 'An account with this email already exists. Try signing in instead.'
	};

	function getFriendlyError(error: string): string {
		return errorMessages[error] || error;
	}

	function handleNextStep(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (currentStep === 1 && isStep1Valid) {
			currentStep = 2;
		}
	}

	function handlePrevStep() {
		errorMessage = '';
		currentStep = 1;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (!isStep2Valid) {
			errorMessage = 'Please fill in all required fields correctly.';
			return;
		}

		registerMutation.mutate(
			{ email, password, displayName, username },
			{
				onSuccess: () => {
					toast.success('Account created! Check your email to verify.');
					goto('/auth/login?registered=true');
				},
				onError: (error: Error) => {
					errorMessage = getFriendlyError(error.message);
					// If it's an email error, go back to step 1
					if (error.message.toLowerCase().includes('email')) {
						currentStep = 1;
					}
				}
			}
		);
	}
</script>

<Card.Root class="w-full max-w-md border-y">
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Create an account</Card.Title>
		<Card.Description>
			{#if currentStep === 1}
				Enter your email and create a password
			{:else}
				Set up your profile
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if errorMessage}
			<div transition:slide={{ duration: 200 }}>
				<Alert variant="destructive" class="mb-4">
					<AlertTriangleIcon class="size-4" />
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			</div>
		{/if}

		{#if currentStep === 1}
			<div transition:fade={{ duration: 200 }}>
				<form onsubmit={handleNextStep} class="space-y-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
							disabled={registerMutation.isPending}
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<PasswordInput
							id="password"
							bind:value={password}
							required
							minlength={8}
							disabled={registerMutation.isPending}
						/>

						{#if password.length > 0 && unmetPasswordReqs().length > 0}
							<p transition:slide={{ duration: 150 }} class="flex items-center gap-2 text-sm text-muted-foreground">
								<CircleAlertIcon class="size-4 shrink-0" />
								Needs: {unmetPasswordReqs().join(', ')}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">Confirm Password</Label>
						<PasswordInput
							id="confirmPassword"
							bind:value={confirmPassword}
							required
							minlength={8}
							disabled={registerMutation.isPending}
						/>
						{#if confirmPassword && !passwordsMatch}
							<p transition:slide={{ duration: 150 }} class="flex items-center gap-2 text-sm text-destructive">
								<CircleAlertIcon class="size-4 shrink-0" />
								Passwords do not match
							</p>
						{/if}
					</div>

					<Button
						type="submit"
						class="w-full gap-2"
						disabled={!isStep1Valid || registerMutation.isPending}
					>
						Continue
						<ArrowRightIcon class="size-4" />
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
					disabled={registerMutation.isPending}
				>
					Sign in with 42
				</Button>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					Already have an account?
					<a href="/auth/login" class="text-primary hover:underline">Sign in</a>
				</p>
			</div>
		{:else}
			<div transition:fade={{ duration: 200 }}>
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="displayName">Display Name</Label>
						<Input
							id="displayName"
							type="text"
							bind:value={displayName}
							required
							minlength={1}
							maxlength={50}
							placeholder="Your display name"
							disabled={registerMutation.isPending}
						/>
						<p class="text-xs text-muted-foreground">This is how your name will appear to others</p>
					</div>

					<div class="space-y-2">
						<Label for="username">Username</Label>
						<Input
							id="username"
							type="text"
							bind:value={username}
							required
							minlength={3}
							maxlength={20}
							pattern="^[a-z0-9_]+$"
							placeholder="your_username"
							disabled={registerMutation.isPending}
						/>
						{#if usernameError()}
							<p transition:slide={{ duration: 150 }} class="flex items-center gap-2 text-sm text-destructive">
								<CircleAlertIcon class="size-4 shrink-0" />
								{usernameError()}
							</p>
						{/if}
					</div>

					<div class="flex gap-3">
						<Button
							type="button"
							variant="outline"
							class="flex-1 gap-2"
							onclick={handlePrevStep}
							disabled={registerMutation.isPending}
						>
							<ArrowLeftIcon class="size-4" />
							Back
						</Button>
						<Button
							type="submit"
							class="flex-1"
							disabled={!isStep2Valid || registerMutation.isPending}
						>
							{registerMutation.isPending ? 'Creating account...' : 'Create account'}
						</Button>
					</div>
				</form>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					Already have an account?
					<a href="/auth/login" class="text-primary hover:underline">Sign in</a>
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
