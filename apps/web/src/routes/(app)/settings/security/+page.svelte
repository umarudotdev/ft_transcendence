<script lang="ts">
	import { goto } from "$app/navigation";
	import * as Card from "$lib/components/ui/card";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Badge } from "$lib/components/ui/badge";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import {
		createChangeEmailMutation,
		createChangePasswordMutation,
		createDeleteAccountMutation,
		createMeQuery,
		createUnlink42Mutation,
		redirectToLink42,
	} from "$lib/queries/auth";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import MailIcon from "@lucide/svelte/icons/mail";
	import KeyIcon from "@lucide/svelte/icons/key";
	import LinkIcon from "@lucide/svelte/icons/link";
	import UnlinkIcon from "@lucide/svelte/icons/unlink";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import CircleIcon from "@lucide/svelte/icons/circle";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import TrashIcon from "@lucide/svelte/icons/trash-2";

	const meQuery = createMeQuery();
	const changePasswordMutation = createChangePasswordMutation();
	const changeEmailMutation = createChangeEmailMutation();
	const unlink42Mutation = createUnlink42Mutation();
	const deleteAccountMutation = createDeleteAccountMutation();

	let currentPassword = $state("");
	let newPassword = $state("");
	let confirmPassword = $state("");
	let successMessage = $state("");

	// Email change state
	let newEmail = $state("");
	let emailPassword = $state("");
	let emailSuccessMessage = $state("");

	// 42 Unlink state
	let unlinkDialogOpen = $state(false);
	let unlinkPassword = $state("");
	let unlinkSuccessMessage = $state("");

	// Delete Account state
	let deleteDialogOpen = $state(false);
	let deletePassword = $state("");
	let deleteConfirmText = $state("");

	const passwordRequirements = $derived({
		minLength: newPassword.length >= 8,
		hasUpper: /[A-Z]/.test(newPassword),
		hasLower: /[a-z]/.test(newPassword),
		hasNumber: /[0-9]/.test(newPassword),
		passwordsMatch: newPassword === confirmPassword && newPassword.length > 0,
	});

	const isPasswordValid = $derived(
		passwordRequirements.minLength &&
			passwordRequirements.hasUpper &&
			passwordRequirements.hasLower &&
			passwordRequirements.hasNumber &&
			passwordRequirements.passwordsMatch
	);

	async function handleChangePassword(e: Event) {
		e.preventDefault();
		successMessage = "";

		if (!isPasswordValid) {
			return;
		}

		changePasswordMutation.mutate(
			{ currentPassword, newPassword },
			{
				onSuccess: () => {
					successMessage =
						"Password changed successfully. You have been logged out of all sessions.";
					currentPassword = "";
					newPassword = "";
					confirmPassword = "";
					setTimeout(() => {
						goto("/auth/login?message=Password changed. Please log in again.");
					}, 2000);
				},
			}
		);
	}

	const isEmailValid = $derived(
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) && emailPassword.length > 0
	);

	async function handleChangeEmail(e: Event) {
		e.preventDefault();
		emailSuccessMessage = "";

		if (!isEmailValid) {
			return;
		}

		changeEmailMutation.mutate(
			{ newEmail, password: emailPassword },
			{
				onSuccess: () => {
					emailSuccessMessage =
						"Verification email sent! Please check your new email address and click the link to confirm the change.";
					newEmail = "";
					emailPassword = "";
				},
			}
		);
	}

	function handleUnlink42(e: Event) {
		e.preventDefault();
		unlinkSuccessMessage = "";

		if (!unlinkPassword) {
			return;
		}

		unlink42Mutation.mutate(
			{ password: unlinkPassword },
			{
				onSuccess: () => {
					unlinkSuccessMessage = "42 account unlinked successfully.";
					unlinkPassword = "";
					unlinkDialogOpen = false;
				},
			}
		);
	}

	const canDeleteAccount = $derived(
		deletePassword.length > 0 && deleteConfirmText === "DELETE"
	);

	function handleDeleteAccount(e: Event) {
		e.preventDefault();

		if (!canDeleteAccount) {
			return;
		}

		deleteAccountMutation.mutate(
			{ password: deletePassword },
			{
				onSuccess: () => {
					goto("/auth/login?message=Your account has been deleted.");
				},
			}
		);
	}
</script>

<svelte:head>
	<title>Security Settings | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<a
			href="/settings"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />
			Back to Settings
		</a>
		<h1 class="mt-4 text-2xl font-bold tracking-tight">Security Settings</h1>
		<p class="text-muted-foreground">Manage your account security settings</p>
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
				Please <a href="/auth/login" class="font-medium underline">log in</a> to access security
				settings.
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
						Change Password
					</Card.Title>
					<Card.Description>Update your password to keep your account secure</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if user.intraId && !user.email}
						<p class="text-sm text-muted-foreground">
							You signed up with 42 OAuth and don't have a password set. To add password
							authentication, please contact support.
						</p>
					{:else}
						<form onsubmit={handleChangePassword} class="space-y-4">
							{#if successMessage}
								<Alert class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
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
								<Label for="current-password">Current Password</Label>
								<Input
									type="password"
									id="current-password"
									bind:value={currentPassword}
									required
									autocomplete="current-password"
								/>
							</div>

							<div class="space-y-2">
								<Label for="new-password">New Password</Label>
								<Input
									type="password"
									id="new-password"
									bind:value={newPassword}
									required
									autocomplete="new-password"
								/>
							</div>

							<div class="space-y-2">
								<Label for="confirm-password">Confirm New Password</Label>
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
									<p class="text-sm font-medium">Password requirements:</p>
									<ul class="mt-2 space-y-1 text-sm">
										<li class="flex items-center gap-2 {passwordRequirements.minLength ? 'text-green-600' : 'text-muted-foreground'}">
											{#if passwordRequirements.minLength}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											At least 8 characters
										</li>
										<li class="flex items-center gap-2 {passwordRequirements.hasUpper ? 'text-green-600' : 'text-muted-foreground'}">
											{#if passwordRequirements.hasUpper}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											One uppercase letter
										</li>
										<li class="flex items-center gap-2 {passwordRequirements.hasLower ? 'text-green-600' : 'text-muted-foreground'}">
											{#if passwordRequirements.hasLower}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											One lowercase letter
										</li>
										<li class="flex items-center gap-2 {passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-foreground'}">
											{#if passwordRequirements.hasNumber}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											One number
										</li>
										<li class="flex items-center gap-2 {passwordRequirements.passwordsMatch ? 'text-green-600' : 'text-muted-foreground'}">
											{#if passwordRequirements.passwordsMatch}
												<CheckCircleIcon class="size-4" />
											{:else}
												<CircleIcon class="size-4" />
											{/if}
											Passwords match
										</li>
									</ul>
								</div>
							{/if}

							<Button type="submit" disabled={!isPasswordValid || changePasswordMutation.isPending}>
								{changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
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
						Change Email
					</Card.Title>
					<Card.Description>Update your email address</Card.Description>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleChangeEmail} class="space-y-4">
						{#if emailSuccessMessage}
							<Alert class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
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
								<span class="font-medium">Current email:</span> {user.email}
							</p>
						</div>

						<div class="space-y-2">
							<Label for="new-email">New Email Address</Label>
							<Input
								type="email"
								id="new-email"
								bind:value={newEmail}
								placeholder="Enter your new email"
								required
								autocomplete="email"
							/>
						</div>

						<div class="space-y-2">
							<Label for="email-password">Current Password</Label>
							<Input
								type="password"
								id="email-password"
								bind:value={emailPassword}
								placeholder="Confirm with your password"
								required
								autocomplete="current-password"
							/>
						</div>

						<p class="text-sm text-muted-foreground">
							A verification email will be sent to your new address. Your email won't change until you click the verification link.
						</p>

						<Button type="submit" disabled={!isEmailValid || changeEmailMutation.isPending}>
							{changeEmailMutation.isPending ? "Sending Verification..." : "Change Email"}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>

			<!-- 42 Account -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<LinkIcon class="size-5" />
						42 Account
					</Card.Title>
					<Card.Description>Link your 42 account for quick sign-in</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if unlinkSuccessMessage}
						<Alert class="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
							<CheckCircleIcon class="size-4" />
							<AlertDescription>{unlinkSuccessMessage}</AlertDescription>
						</Alert>
					{/if}

					{#if user.intraId}
						<div class="flex items-center justify-between">
							<div>
								<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
									<CheckCircleIcon class="mr-1 size-3" />
									42 Account Linked
								</Badge>
								<p class="mt-2 text-sm text-muted-foreground">
									Your 42 account is connected. You can use it to sign in.
								</p>
							</div>
							{#if user.email}
								<Dialog.Root bind:open={unlinkDialogOpen}>
									<Dialog.Trigger>
										{#snippet child({ props })}
											<Button variant="outline" class="text-destructive hover:text-destructive" {...props}>
												<UnlinkIcon class="mr-2 size-4" />
												Unlink
											</Button>
										{/snippet}
									</Dialog.Trigger>
									<Dialog.Content class="sm:max-w-md">
										<Dialog.Header>
											<Dialog.Title>Unlink 42 Account</Dialog.Title>
											<Dialog.Description>
												Enter your password to confirm unlinking your 42 account. You can re-link it later.
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
												<Label for="unlink-password">Password</Label>
												<Input
													type="password"
													id="unlink-password"
													bind:value={unlinkPassword}
													placeholder="Enter your password"
													required
													autocomplete="current-password"
												/>
											</div>

											<Dialog.Footer>
												<Button type="button" variant="outline" onclick={() => (unlinkDialogOpen = false)}>
													Cancel
												</Button>
												<Button
													type="submit"
													variant="destructive"
													disabled={!unlinkPassword || unlink42Mutation.isPending}
												>
													{unlink42Mutation.isPending ? "Unlinking..." : "Unlink Account"}
												</Button>
											</Dialog.Footer>
										</form>
									</Dialog.Content>
								</Dialog.Root>
							{/if}
						</div>
						{#if !user.email}
							<p class="mt-2 text-sm text-muted-foreground">
								Set up a password first to be able to unlink your 42 account.
							</p>
						{/if}
					{:else}
						<Button variant="outline" onclick={redirectToLink42}>
							<LinkIcon class="mr-2 size-4" />
							Link 42 Account
						</Button>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Two-Factor Authentication -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<ShieldIcon class="size-5" />
						Two-Factor Authentication
					</Card.Title>
					<Card.Description>Add an extra layer of security to your account</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if user.twoFactorEnabled}
						<div class="flex items-center justify-between">
							<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
								<CheckCircleIcon class="mr-1 size-3" />
								2FA Enabled
							</Badge>
							<Button variant="link" class="text-destructive" href="/settings/2fa?action=disable">
								Disable 2FA
							</Button>
						</div>
						<p class="mt-2 text-sm text-muted-foreground">
							Your account is protected with two-factor authentication.
						</p>
					{:else}
						<Button href="/settings/2fa">
							<ShieldIcon class="mr-2 size-4" />
							Enable 2FA
						</Button>
						<p class="mt-2 text-sm text-muted-foreground">
							Protect your account with time-based one-time passwords (TOTP).
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Active Sessions -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<LogOutIcon class="size-5" />
						Active Sessions
					</Card.Title>
					<Card.Description>Sign out from all devices if you suspect unauthorized access</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button variant="destructive" href="/auth/logout?all=true">
						<LogOutIcon class="mr-2 size-4" />
						Sign Out All Devices
					</Button>
				</Card.Content>
			</Card.Root>

			<!-- Delete Account -->
			<Card.Root class="border-destructive">
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-destructive">
						<TrashIcon class="size-5" />
						Delete Account
					</Card.Title>
					<Card.Description>Permanently delete your account and all associated data</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if user.intraId && !user.email}
						<Alert variant="destructive">
							<AlertTriangleIcon class="size-4" />
							<AlertDescription>
								OAuth-only accounts cannot be deleted through this interface. Please contact support for assistance.
							</AlertDescription>
						</Alert>
					{:else}
						<p class="mb-4 text-sm text-muted-foreground">
							This action is irreversible. All your data, including match history, achievements, and messages will be permanently deleted.
						</p>
						<Dialog.Root bind:open={deleteDialogOpen}>
							<Dialog.Trigger>
								{#snippet child({ props })}
									<Button variant="destructive" {...props}>
										<TrashIcon class="mr-2 size-4" />
										Delete My Account
									</Button>
								{/snippet}
							</Dialog.Trigger>
							<Dialog.Content class="sm:max-w-md">
								<Dialog.Header>
									<Dialog.Title class="text-destructive">Delete Account</Dialog.Title>
									<Dialog.Description>
										This action cannot be undone. All your data will be permanently deleted.
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
										<Label for="delete-password">Password</Label>
										<Input
											type="password"
											id="delete-password"
											bind:value={deletePassword}
											placeholder="Enter your password"
											required
											autocomplete="current-password"
										/>
									</div>

									<div class="space-y-2">
										<Label for="delete-confirm">Type DELETE to confirm</Label>
										<Input
											type="text"
											id="delete-confirm"
											bind:value={deleteConfirmText}
											placeholder="DELETE"
											required
											autocomplete="off"
										/>
									</div>

									<Dialog.Footer>
										<Button type="button" variant="outline" onclick={() => {
											deleteDialogOpen = false;
											deletePassword = "";
											deleteConfirmText = "";
										}}>
											Cancel
										</Button>
										<Button
											type="submit"
											variant="destructive"
											disabled={!canDeleteAccount || deleteAccountMutation.isPending}
										>
											{deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
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
