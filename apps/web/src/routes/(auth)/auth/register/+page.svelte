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
	import { m } from '$lib/paraglide/messages.js';

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
		if (!passwordRequirements.minLength) unmet.push(m.password_8_chars());
		if (!passwordRequirements.hasUppercase) unmet.push(m.password_uppercase());
		if (!passwordRequirements.hasLowercase) unmet.push(m.password_lowercase());
		if (!passwordRequirements.hasNumber) unmet.push(m.password_number());
		return unmet;
	});

	// Username error message (show first failing requirement)
	const usernameError = $derived(() => {
		if (username.length === 0) return null;
		if (!usernameRequirements.minLength) return m.username_min_length();
		if (!usernameRequirements.maxLength) return m.username_max_length();
		if (!usernameRequirements.validChars)
			return m.username_valid_chars();
		return null;
	});

	// Step validation
	const isStep1Valid = $derived(email.length > 0 && isPasswordValid && passwordsMatch);

	const isStep2Valid = $derived(
		displayName.length > 0 &&
			usernameRequirements.minLength &&
			usernameRequirements.maxLength &&
			usernameRequirements.validChars
	);

	// User-friendly error messages
	const errorMessages: Record<string, () => string> = {
		'Email already exists': () => m.auth_error_email_exists(),
		'Username already exists': () => m.auth_error_username_exists(),
		'Invalid email': () => m.auth_error_invalid_email(),
		'Weak password': () => m.auth_error_weak_password(),
		'Email already registered': () => m.auth_error_email_already_registered()
	};

	function getFriendlyError(error: string): string {
		return errorMessages[error]?.() ?? error;
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
			errorMessage = m.auth_register_fill_fields();
			return;
		}

		registerMutation.mutate(
			{ email, password, displayName, username },
			{
				onSuccess: () => {
					toast.success(m.auth_register_success_toast());
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
		<Card.Title class="text-2xl">{m.auth_register_title()}</Card.Title>
		<Card.Description>
			{#if currentStep === 1}
				{m.auth_register_step1_description()}
			{:else}
				{m.auth_register_step2_description()}
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
						<Label for="email">{m.common_email()}</Label>
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
						<Label for="password">{m.common_password()}</Label>
						<PasswordInput
							id="password"
							bind:value={password}
							required
							minlength={8}
							disabled={registerMutation.isPending}
						/>

						{#if password.length > 0 && unmetPasswordReqs().length > 0}
							<p
								transition:slide={{ duration: 150 }}
								class="flex items-center gap-2 text-sm text-muted-foreground"
							>
								<CircleAlertIcon class="size-4 shrink-0" />
								{m.password_needs({ requirements: unmetPasswordReqs().join(', ') })}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">{m.auth_register_confirm_password()}</Label>
						<PasswordInput
							id="confirmPassword"
							bind:value={confirmPassword}
							required
							minlength={8}
							disabled={registerMutation.isPending}
						/>
						{#if confirmPassword && !passwordsMatch}
							<p
								transition:slide={{ duration: 150 }}
								class="flex items-center gap-2 text-sm text-destructive"
							>
								<CircleAlertIcon class="size-4 shrink-0" />
								{m.auth_register_password_mismatch()}
							</p>
						{/if}
					</div>

					<Button
						type="submit"
						class="w-full gap-2"
						disabled={!isStep1Valid || registerMutation.isPending}
					>
						{m.common_continue()}
						<ArrowRightIcon class="size-4" />
					</Button>
				</form>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">{m.common_or_continue_with()}</span>
					</div>
				</div>

				<Button
					variant="outline"
					class="w-full"
					onclick={redirectTo42OAuth}
					disabled={registerMutation.isPending}
				>
					{m.auth_login_sign_in_42()}
				</Button>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					{m.auth_register_has_account()}
					<a href="/auth/login" class="text-primary hover:underline">{m.common_sign_in()}</a>
				</p>
			</div>
		{:else}
			<div transition:fade={{ duration: 200 }}>
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="displayName">{m.auth_register_display_name()}</Label>
						<Input
							id="displayName"
							type="text"
							bind:value={displayName}
							required
							minlength={1}
							maxlength={50}
							placeholder={m.auth_register_display_name_placeholder()}
							disabled={registerMutation.isPending}
						/>
						<p class="text-xs text-muted-foreground">{m.auth_register_display_name_help()}</p>
					</div>

					<div class="space-y-2">
						<Label for="username">{m.auth_register_username()}</Label>
						<Input
							id="username"
							type="text"
							bind:value={username}
							required
							minlength={3}
							maxlength={20}
							pattern="^[a-z0-9_]+$"
							placeholder={m.auth_register_username_placeholder()}
							disabled={registerMutation.isPending}
						/>
						{#if usernameError()}
							<p
								transition:slide={{ duration: 150 }}
								class="flex items-center gap-2 text-sm text-destructive"
							>
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
							{m.common_back()}
						</Button>
						<Button
							type="submit"
							class="flex-1"
							disabled={!isStep2Valid || registerMutation.isPending}
						>
							{registerMutation.isPending ? m.auth_register_creating() : m.auth_register_create()}
						</Button>
					</div>
				</form>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					{m.auth_register_has_account()}
					<a href="/auth/login" class="text-primary hover:underline">{m.common_sign_in()}</a>
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
