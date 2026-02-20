<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import {
		createChangeEmailMutation,
		createChangePasswordMutation,
		createDeleteAccountMutation,
		createMeQuery,
		createSetPasswordMutation,
		createUnlink42Mutation,
		redirectToLink42
	} from '$lib/queries/auth';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import MailIcon from '@lucide/svelte/icons/mail';
	import KeyIcon from '@lucide/svelte/icons/key';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UnlinkIcon from '@lucide/svelte/icons/unlink';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	const meQuery = createMeQuery();
	const changePasswordMutation = createChangePasswordMutation();
	const setPasswordMutation = createSetPasswordMutation();
	const changeEmailMutation = createChangeEmailMutation();
	const unlink42Mutation = createUnlink42Mutation();
	const deleteAccountMutation = createDeleteAccountMutation();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let successMessage = $state('');

	// Set password state (for OAuth-only users)
	let setNewPassword = $state('');
	let setConfirmPassword = $state('');
	let setPasswordSuccessMessage = $state('');

	// Email change state
	let newEmail = $state('');
	let emailPassword = $state('');
	let emailSuccessMessage = $state('');

	// 42 Unlink state
	let unlinkDialogOpen = $state(false);
	let unlinkPassword = $state('');
	let unlinkSuccessMessage = $state('');

	// Delete Account state
	let deleteDialogOpen = $state(false);
	let deletePassword = $state('');
	let deleteConfirmText = $state('');

	const passwordRequirements = $derived({
		minLength: newPassword.length >= 8,
		hasUpper: /[A-Z]/.test(newPassword),
		hasLower: /[a-z]/.test(newPassword),
		hasNumber: /[0-9]/.test(newPassword),
		passwordsMatch: newPassword === confirmPassword && newPassword.length > 0
	});

	const isPasswordValid = $derived(
		passwordRequirements.minLength &&
			passwordRequirements.hasUpper &&
			passwordRequirements.hasLower &&
			passwordRequirements.hasNumber &&
			passwordRequirements.passwordsMatch
	);

	// Set password requirements (for OAuth-only users)
	const setPasswordRequirements = $derived({
		minLength: setNewPassword.length >= 8,
		hasUpper: /[A-Z]/.test(setNewPassword),
		hasLower: /[a-z]/.test(setNewPassword),
		hasNumber: /[0-9]/.test(setNewPassword),
		passwordsMatch: setNewPassword === setConfirmPassword && setNewPassword.length > 0
	});

	const isSetPasswordValid = $derived(
		setPasswordRequirements.minLength &&
			setPasswordRequirements.hasUpper &&
			setPasswordRequirements.hasLower &&
			setPasswordRequirements.hasNumber &&
			setPasswordRequirements.passwordsMatch
	);

	async function handleChangePassword(e: Event) {
		e.preventDefault();
		successMessage = '';

		if (!isPasswordValid) {
			return;
		}

		changePasswordMutation.mutate(
			{ currentPassword, newPassword },
			{
				onSuccess: () => {
					successMessage = m.security_password_changed();
					currentPassword = '';
					newPassword = '';
					confirmPassword = '';
					setTimeout(() => {
						goto(`/auth/login?message=${encodeURIComponent(m.security_password_changed_redirect())}`);
					}, 2000);
				}
			}
		);
	}

	async function handleSetPassword(e: Event) {
		e.preventDefault();
		setPasswordSuccessMessage = '';

		if (!isSetPasswordValid) {
			return;
		}

		setPasswordMutation.mutate(
			{ password: setNewPassword },
			{
				onSuccess: () => {
					setPasswordSuccessMessage = m.security_password_set();
					setNewPassword = '';
					setConfirmPassword = '';
				}
			}
		);
	}

	const isEmailValid = $derived(
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) && emailPassword.length > 0
	);

	async function handleChangeEmail(e: Event) {
		e.preventDefault();
		emailSuccessMessage = '';

		if (!isEmailValid) {
			return;
		}

		changeEmailMutation.mutate(
			{ newEmail, password: emailPassword },
			{
				onSuccess: () => {
					emailSuccessMessage = m.security_email_verification_sent();
					newEmail = '';
					emailPassword = '';
				}
			}
		);
	}

	function handleUnlink42(e: Event) {
		e.preventDefault();
		unlinkSuccessMessage = '';

		if (!unlinkPassword) {
			return;
		}

		unlink42Mutation.mutate(
			{ password: unlinkPassword },
			{
				onSuccess: () => {
					unlinkSuccessMessage = m.security_42_unlinked();
					unlinkPassword = '';
					unlinkDialogOpen = false;
				}
			}
		);
	}

	const canDeleteAccount = $derived(deletePassword.length > 0 && deleteConfirmText === 'DELETE');

	function handleDeleteAccount(e: Event) {
		e.preventDefault();

		if (!canDeleteAccount) {
			return;
		}

		deleteAccountMutation.mutate(
			{ password: deletePassword },
			{
				onSuccess: () => {
					goto(`/auth/login?message=${encodeURIComponent(m.security_account_deleted_redirect())}`);
				}
			}
		);
	}
</script>

<svelte:head>
	<title>{m.security_title()} | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<a
			href="/settings"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />
			{m.security_back()}
		</a>
		<h1 class="mt-4 text-2xl font-bold tracking-tight">{m.security_title()}</h1>
		<p class="text-muted-foreground">{m.security_subtitle()}</p>
	</div>

	{#if meQuery.isPending}
		<div class="space-y-6">
			{#each Array(4) as _}
				<Card.Root>
					<Card.Content class="p-6">
						<Skeleton class="mb-2 h-5 w-32" />
						<Skeleton class="h-4 w-48" />
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if meQuery.error}
		<Alert variant="destructive">
			<AlertTriangleIcon class="size-4" />
			<AlertDescription>
				{m.security_login_required()}
			</AlertDescription>
		</Alert>
	{:else if meQuery.data}
		{@const user = meQuery.data}
		<div class="space-y-6">
			<!-- Change Password -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<KeyIcon class="size-5" />
						{#if !user.hasPassword}
							{m.security_set_password()}
						{:else}
							{m.security_change_password()}
						{/if}
					</Card.Title>
					<Card.Description>
						{#if !user.hasPassword}
							{m.security_set_password_description()}
						{:else}
							{m.security_change_password_description()}
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if !user.hasPassword}
						<p class="mb-4 text-sm text-muted-foreground">
							{m.security_set_password_info()}
						</p>
						<form onsubmit={handleSetPassword} class="space-y-4">
							{#if setPasswordSuccessMessage}
								<Alert
									class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
								>
									<CheckCircleIcon class="size-4" />
									<AlertDescription>{setPasswordSuccessMessage}</AlertDescription>
								</Alert>
							{/if}

							{#if setPasswordMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{setPasswordMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<div class="space-y-2">
								<Label for="set-new-password">{m.security_new_password()}</Label>
								<Input
									type="password"
									id="set-new-password"
									bind:value={setNewPassword}
									required
									autocomplete="new-password"
								/>
							</div>

							<div class="space-y-2">
								<Label for="set-confirm-password">{m.security_confirm_new_password()}</Label>
								<Input
									type="password"
									id="set-confirm-password"
									bind:value={setConfirmPassword}
									required
									autocomplete="new-password"
								/>
							</div>

							{#if setNewPassword.length > 0}
								<div class="rounded-lg bg-muted p-4">
									<p class="text-sm font-medium">{m.password_requirements_title()}</p>
									<ul class="mt-2 space-y-1 text-sm">
										<li
											class="flex items-center gap-2 {setPasswordRequirements.minLength
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if setPasswordRequirements.minLength}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_min_length()}
										</li>
										<li
											class="flex items-center gap-2 {setPasswordRequirements.hasUpper
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if setPasswordRequirements.hasUpper}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_uppercase()}
										</li>
										<li
											class="flex items-center gap-2 {setPasswordRequirements.hasLower
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if setPasswordRequirements.hasLower}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_lowercase()}
										</li>
										<li
											class="flex items-center gap-2 {setPasswordRequirements.hasNumber
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if setPasswordRequirements.hasNumber}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_number()}
										</li>
										<li
											class="flex items-center gap-2 {setPasswordRequirements.passwordsMatch
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if setPasswordRequirements.passwordsMatch}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_passwords_match()}
										</li>
									</ul>
								</div>
							{/if}

							<Button type="submit" disabled={!isSetPasswordValid || setPasswordMutation.isPending}>
								{setPasswordMutation.isPending ? m.security_setting_password() : m.security_set_password_button()}
							</Button>
						</form>
					{:else}
						<form onsubmit={handleChangePassword} class="space-y-4">
							{#if successMessage}
								<Alert
									class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
								>
									<CheckCircleIcon class="size-4" />
									<AlertDescription>{successMessage}</AlertDescription>
								</Alert>
							{/if}

							{#if changePasswordMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{changePasswordMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<div class="space-y-2">
								<Label for="current-password">{m.security_current_password()}</Label>
								<Input
									type="password"
									id="current-password"
									bind:value={currentPassword}
									required
									autocomplete="current-password"
								/>
							</div>

							<div class="space-y-2">
								<Label for="new-password">{m.security_new_password()}</Label>
								<Input
									type="password"
									id="new-password"
									bind:value={newPassword}
									required
									autocomplete="new-password"
								/>
							</div>

							<div class="space-y-2">
								<Label for="confirm-password">{m.security_confirm_new_password()}</Label>
								<Input
									type="password"
									id="confirm-password"
									bind:value={confirmPassword}
									required
									autocomplete="new-password"
								/>
							</div>

							{#if newPassword.length > 0}
								<div class="rounded-lg bg-muted p-4">
									<p class="text-sm font-medium">{m.password_requirements_title()}</p>
									<ul class="mt-2 space-y-1 text-sm">
										<li
											class="flex items-center gap-2 {passwordRequirements.minLength
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if passwordRequirements.minLength}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_min_length()}
										</li>
										<li
											class="flex items-center gap-2 {passwordRequirements.hasUpper
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if passwordRequirements.hasUpper}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_uppercase()}
										</li>
										<li
											class="flex items-center gap-2 {passwordRequirements.hasLower
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if passwordRequirements.hasLower}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_lowercase()}
										</li>
										<li
											class="flex items-center gap-2 {passwordRequirements.hasNumber
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if passwordRequirements.hasNumber}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_one_number()}
										</li>
										<li
											class="flex items-center gap-2 {passwordRequirements.passwordsMatch
												? 'text-green-600'
												: 'text-muted-foreground'}"
										>
											{#if passwordRequirements.passwordsMatch}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											{m.password_passwords_match()}
										</li>
									</ul>
								</div>
							{/if}

							<Button type="submit" disabled={!isPasswordValid || changePasswordMutation.isPending}>
								{changePasswordMutation.isPending ? m.security_changing_password() : m.security_change_password_button()}
							</Button>
						</form>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Change Email -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<MailIcon class="size-5" />
						{m.security_change_email()}
					</Card.Title>
					<Card.Description>{m.security_change_email_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleChangeEmail} class="space-y-4">
						{#if emailSuccessMessage}
							<Alert
								class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
							>
								<CheckCircleIcon class="size-4" />
								<AlertDescription>{emailSuccessMessage}</AlertDescription>
							</Alert>
						{/if}

						{#if changeEmailMutation.error}
							<Alert variant="destructive">
								<AlertTriangleIcon class="size-4" />
								<AlertDescription>{changeEmailMutation.error.message}</AlertDescription>
							</Alert>
						{/if}

						<div class="rounded-lg bg-muted p-3">
							<p class="text-sm text-muted-foreground">
								<span class="font-medium">{m.security_current_email()}</span>
								{user.email}
							</p>
						</div>

						<div class="space-y-2">
							<Label for="new-email">{m.security_new_email()}</Label>
							<Input
								type="email"
								id="new-email"
								bind:value={newEmail}
								placeholder={m.security_new_email_placeholder()}
								required
								autocomplete="email"
							/>
						</div>

						<div class="space-y-2">
							<Label for="email-password">{m.security_current_password()}</Label>
							<Input
								type="password"
								id="email-password"
								bind:value={emailPassword}
								placeholder={m.security_email_password_placeholder()}
								required
								autocomplete="current-password"
							/>
						</div>

						<p class="text-sm text-muted-foreground">
							{m.security_email_verification_note()}
						</p>

						<Button type="submit" disabled={!isEmailValid || changeEmailMutation.isPending}>
							{changeEmailMutation.isPending ? m.security_sending_verification() : m.security_change_email_button()}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>

			<!-- 42 Account -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<LinkIcon class="size-5" />
						{m.security_42_account()}
					</Card.Title>
					<Card.Description>{m.security_42_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if unlinkSuccessMessage}
						<Alert
							class="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
						>
							<CheckCircleIcon class="size-4" />
							<AlertDescription>{unlinkSuccessMessage}</AlertDescription>
						</Alert>
					{/if}

					{#if user.intraId}
						<div class="flex items-center justify-between">
							<div>
								<Badge
									variant="secondary"
									class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
								>
									<CheckCircleIcon class="mr-1 size-3" />
									{m.security_42_linked()}
								</Badge>
								<p class="mt-2 text-sm text-muted-foreground">
									{m.security_42_linked_info()}
								</p>
							</div>
							{#if user.hasPassword}
								<Dialog.Root bind:open={unlinkDialogOpen}>
									<Dialog.Trigger>
										{#snippet child({ props })}
											<Button
												variant="outline"
												class="text-destructive hover:text-destructive"
												{...props}
											>
												<UnlinkIcon class="mr-2 size-4" />
												{m.security_42_unlink()}
											</Button>
										{/snippet}
									</Dialog.Trigger>
									<Dialog.Content class="sm:max-w-md">
										<Dialog.Header>
											<Dialog.Title>{m.security_42_unlink_title()}</Dialog.Title>
											<Dialog.Description>
												{m.security_42_unlink_description()}
											</Dialog.Description>
										</Dialog.Header>
										<form onsubmit={handleUnlink42} class="space-y-4">
											{#if unlink42Mutation.error}
												<Alert variant="destructive">
													<AlertTriangleIcon class="size-4" />
													<AlertDescription>{unlink42Mutation.error.message}</AlertDescription>
												</Alert>
											{/if}

											<div class="space-y-2">
												<Label for="unlink-password">{m.common_password()}</Label>
												<Input
													type="password"
													id="unlink-password"
													bind:value={unlinkPassword}
													placeholder={m.security_enter_password_placeholder()}
													required
													autocomplete="current-password"
												/>
											</div>

											<Dialog.Footer>
												<Button
													type="button"
													variant="outline"
													onclick={() => (unlinkDialogOpen = false)}
												>
													{m.common_cancel()}
												</Button>
												<Button
													type="submit"
													variant="destructive"
													disabled={!unlinkPassword || unlink42Mutation.isPending}
												>
													{unlink42Mutation.isPending ? m.security_42_unlinking() : m.security_42_unlink_confirm()}
												</Button>
											</Dialog.Footer>
										</form>
									</Dialog.Content>
								</Dialog.Root>
							{/if}
						</div>
						{#if !user.hasPassword}
							<p class="mt-2 text-sm text-muted-foreground">
								{m.security_42_set_password_first()}
							</p>
						{/if}
					{:else}
						<Button variant="outline" onclick={redirectToLink42}>
							<LinkIcon class="mr-2 size-4" />
							{m.security_42_link()}
						</Button>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Two-Factor Authentication -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<ShieldIcon class="size-5" />
						{m.security_2fa_title()}
					</Card.Title>
					<Card.Description>{m.security_2fa_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if user.twoFactorEnabled}
						<div class="flex items-center justify-between">
							<Badge
								variant="secondary"
								class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
							>
								<CheckCircleIcon class="mr-1 size-3" />
								{m.security_2fa_enabled()}
							</Badge>
							<Button variant="link" class="text-destructive" href="/settings/2fa?action=disable">
								{m.security_2fa_disable()}
							</Button>
						</div>
						<p class="mt-2 text-sm text-muted-foreground">
							{m.security_2fa_enabled_info()}
						</p>
					{:else}
						<Button href="/settings/2fa">
							<ShieldIcon class="mr-2 size-4" />
							{m.security_2fa_enable()}
						</Button>
						<p class="mt-2 text-sm text-muted-foreground">
							{m.security_2fa_totp_info()}
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Active Sessions -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<LogOutIcon class="size-5" />
						{m.security_sessions_title()}
					</Card.Title>
					<Card.Description
						>{m.security_sessions_description()}</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<Button variant="destructive" href="/auth/logout?all=true">
						<LogOutIcon class="mr-2 size-4" />
						{m.security_sessions_sign_out_all()}
					</Button>
				</Card.Content>
			</Card.Root>

			<!-- Delete Account -->
			<Card.Root class="border-destructive">
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-destructive">
						<TrashIcon class="size-5" />
						{m.security_delete_title()}
					</Card.Title>
					<Card.Description
						>{m.security_delete_description()}</Card.Description
					>
				</Card.Header>
				<Card.Content>
					{#if !user.hasPassword}
						<Alert variant="destructive">
							<AlertTriangleIcon class="size-4" />
							<AlertDescription>
								{m.security_delete_need_password()}
							</AlertDescription>
						</Alert>
					{:else}
						<p class="mb-4 text-sm text-muted-foreground">
							{m.security_delete_warning()}
						</p>
						<Dialog.Root bind:open={deleteDialogOpen}>
							<Dialog.Trigger>
								{#snippet child({ props })}
									<Button variant="destructive" {...props}>
										<TrashIcon class="mr-2 size-4" />
										{m.security_delete_button()}
									</Button>
								{/snippet}
							</Dialog.Trigger>
							<Dialog.Content class="sm:max-w-md">
								<Dialog.Header>
									<Dialog.Title class="text-destructive">{m.security_delete_dialog_title()}</Dialog.Title>
									<Dialog.Description>
										{m.security_delete_dialog_description()}
									</Dialog.Description>
								</Dialog.Header>
								<form onsubmit={handleDeleteAccount} class="space-y-4">
									{#if deleteAccountMutation.error}
										<Alert variant="destructive">
											<AlertTriangleIcon class="size-4" />
											<AlertDescription>{deleteAccountMutation.error.message}</AlertDescription>
										</Alert>
									{/if}

									<div class="space-y-2">
										<Label for="delete-password">{m.common_password()}</Label>
										<Input
											type="password"
											id="delete-password"
											bind:value={deletePassword}
											placeholder={m.security_enter_password_placeholder()}
											required
											autocomplete="current-password"
										/>
									</div>

									<div class="space-y-2">
										<Label for="delete-confirm">{m.security_delete_type_confirm()}</Label>
										<Input
											type="text"
											id="delete-confirm"
											bind:value={deleteConfirmText}
											placeholder={m.security_delete_type_text()}
											required
											autocomplete="off"
										/>
									</div>

									<Dialog.Footer>
										<Button
											type="button"
											variant="outline"
											onclick={() => {
												deleteDialogOpen = false;
												deletePassword = '';
												deleteConfirmText = '';
											}}
										>
											{m.common_cancel()}
										</Button>
										<Button
											type="submit"
											variant="destructive"
											disabled={!canDeleteAccount || deleteAccountMutation.isPending}
										>
											{deleteAccountMutation.isPending ? m.security_delete_deleting() : m.security_delete_confirm()}
										</Button>
									</Dialog.Footer>
								</form>
							</Dialog.Content>
						</Dialog.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
