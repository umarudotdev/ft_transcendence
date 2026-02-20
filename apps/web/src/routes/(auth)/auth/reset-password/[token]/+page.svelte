<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { PasswordInput } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { toast } from 'svelte-sonner';
	import { slide, fade } from 'svelte/transition';
	import { createResetPasswordMutation } from '$lib/queries/auth';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import { m } from '$lib/paraglide/messages.js';

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
		hasNumber: /[0-9]/.test(password)
	});

	const isPasswordValid = $derived(
		passwordRequirements.minLength &&
			passwordRequirements.hasUppercase &&
			passwordRequirements.hasLowercase &&
			passwordRequirements.hasNumber
	);

	const passwordsMatch = $derived(password === confirmPassword && password.length > 0);

	// Condensed password requirements text (only show unmet)
	const unmetPasswordReqs = $derived(() => {
		const unmet: string[] = [];
		if (!passwordRequirements.minLength) unmet.push(m.password_8_chars());
		if (!passwordRequirements.hasUppercase) unmet.push(m.password_uppercase());
		if (!passwordRequirements.hasLowercase) unmet.push(m.password_lowercase());
		if (!passwordRequirements.hasNumber) unmet.push(m.password_number());
		return unmet;
	});

	// User-friendly error messages
	const errorMessages: Record<string, () => string> = {
		'Invalid token': () => m.auth_reset_invalid_token(),
		'Token expired': () => m.auth_reset_expired_token(),
		'Expired token': () => m.auth_reset_expired_token(),
		'Weak password': () => m.auth_error_weak_password()
	};

	function getFriendlyError(error: string): string {
		return errorMessages[error]?.() ?? error;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (!isPasswordValid) {
			errorMessage = m.auth_reset_meet_requirements();
			return;
		}

		if (!passwordsMatch) {
			errorMessage = m.auth_reset_passwords_mismatch();
			return;
		}

		const token = page.params.token;
		if (!token) {
			errorMessage = m.auth_reset_invalid_link();
			return;
		}

		resetMutation.mutate(
			{ token, password },
			{
				onSuccess: () => {
					toast.success(m.auth_reset_success());
					success = true;
				},
				onError: (error: Error) => {
					errorMessage = getFriendlyError(error.message);
				}
			}
		);
	}
</script>

<Card.Root class="w-full max-w-md border-y">
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">{m.auth_reset_title()}</Card.Title>
		<Card.Description>{m.auth_reset_description()}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if success}
			<div transition:fade={{ duration: 200 }}>
				<Alert
					class="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
				>
					<CheckCircleIcon class="size-4" />
					<AlertDescription>
						{m.auth_reset_success()}
					</AlertDescription>
				</Alert>
				<Button class="w-full" onclick={() => goto('/auth/login')}>{m.auth_reset_go_to_login()}</Button>
			</div>
		{:else}
			<div transition:fade={{ duration: 200 }}>
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if errorMessage}
						<div transition:slide={{ duration: 200 }}>
							<Alert variant="destructive">
								<AlertTriangleIcon class="size-4" />
								<AlertDescription>
									{errorMessage}
									{#if errorMessage.includes('expired')}
										<a href="/auth/forgot-password" class="ml-1 underline hover:no-underline">
											{m.auth_reset_request_new_link()}
										</a>
									{/if}
								</AlertDescription>
							</Alert>
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="password">{m.auth_reset_new_password()}</Label>
						<PasswordInput
							id="password"
							bind:value={password}
							required
							minlength={8}
							disabled={resetMutation.isPending}
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
						<Label for="confirmPassword">{m.auth_reset_confirm_password()}</Label>
						<PasswordInput
							id="confirmPassword"
							bind:value={confirmPassword}
							required
							minlength={8}
							disabled={resetMutation.isPending}
						/>
						{#if confirmPassword && !passwordsMatch}
							<p
								transition:slide={{ duration: 150 }}
								class="flex items-center gap-2 text-sm text-destructive"
							>
								<CircleAlertIcon class="size-4 shrink-0" />
								{m.auth_reset_passwords_mismatch()}
							</p>
						{/if}
					</div>

					<Button
						type="submit"
						class="w-full"
						disabled={resetMutation.isPending || !isPasswordValid || !passwordsMatch}
					>
						{resetMutation.isPending ? m.auth_reset_resetting() : m.auth_reset_submit()}
					</Button>
				</form>

				<p class="mt-4 text-center text-sm text-muted-foreground">
					<a href="/auth/login" class="text-primary hover:underline">{m.auth_reset_back_to_login()}</a>
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
