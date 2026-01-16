<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import * as InputOTP from "$lib/components/ui/input-otp";
	import { Label } from "$lib/components/ui/label";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import {
		createDisable2faMutation,
		createEnable2faMutation,
		createMeQuery,
		createVerify2faMutation,
		type Enable2faResponse,
	} from "$lib/queries/auth";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";

	const meQuery = createMeQuery();
	const enable2faMutation = createEnable2faMutation();
	const verify2faMutation = createVerify2faMutation();
	const disable2faMutation = createDisable2faMutation();

	const action = $derived($page.url.searchParams.get("action"));
	const isDisableMode = $derived(action === "disable");

	let verificationCode = $state("");
	let qrData = $state<{ qrCodeUrl: string; secret: string } | null>(null);
	let step = $state<"initial" | "verify">("initial");
	let successMessage = $state("");

	async function handleEnableSetup() {
		enable2faMutation.mutate(undefined, {
			onSuccess: (data: Enable2faResponse) => {
				qrData = {
					qrCodeUrl: data.qrCodeUrl,
					secret: data.secret,
				};
				step = "verify";
			},
		});
	}

	async function handleVerifyAndEnable(e: Event) {
		e.preventDefault();
		if (verificationCode.length !== 6) return;

		verify2faMutation.mutate(
			{ code: verificationCode },
			{
				onSuccess: () => {
					successMessage = "Two-factor authentication enabled successfully!";
					setTimeout(() => {
						goto("/settings/security");
					}, 2000);
				},
			}
		);
	}

	async function handleDisable(e: Event) {
		e.preventDefault();
		if (verificationCode.length !== 6) return;

		disable2faMutation.mutate(
			{ code: verificationCode },
			{
				onSuccess: () => {
					successMessage = "Two-factor authentication disabled.";
					setTimeout(() => {
						goto("/settings/security");
					}, 2000);
				},
			}
		);
	}

</script>

<svelte:head>
	<title>
		{isDisableMode ? "Disable" : "Enable"} Two-Factor Authentication | ft_transcendence
	</title>
</svelte:head>

<div class="mx-auto max-w-lg space-y-6">
	<div>
		<a
			href="/settings/security"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />
			Back to Security Settings
		</a>
		<h1 class="mt-4 text-2xl font-bold tracking-tight">
			{isDisableMode ? "Disable Two-Factor Authentication" : "Enable Two-Factor Authentication"}
		</h1>
		<p class="text-muted-foreground">
			{isDisableMode
				? "Enter your authenticator code to disable 2FA"
				: "Secure your account with time-based one-time passwords"}
		</p>
	</div>

	{#if meQuery.isPending}
		<Card.Root>
			<Card.Content class="p-6">
				<Skeleton class="mx-auto mb-4 h-16 w-16 rounded-full" />
				<Skeleton class="mx-auto mb-2 h-5 w-48" />
				<Skeleton class="mx-auto h-4 w-64" />
			</Card.Content>
		</Card.Root>
	{:else if meQuery.error}
		<Alert variant="destructive">
			<AlertTriangleIcon class="size-4" />
			<AlertDescription>
				Please <a href="/auth/login" class="font-medium underline">log in</a> to manage 2FA settings.
			</AlertDescription>
		</Alert>
	{:else if meQuery.data}
		{@const user = meQuery.data}
		<Card.Root>
			<Card.Content class="p-6">
				{#if successMessage}
					<Alert class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
						<CheckCircleIcon class="size-4" />
						<AlertDescription>{successMessage}</AlertDescription>
					</Alert>
				{:else if isDisableMode}
					{#if !user.twoFactorEnabled}
						<Alert>
							<AlertTriangleIcon class="size-4" />
							<AlertDescription>
								Two-factor authentication is not enabled on your account.
							</AlertDescription>
						</Alert>
					{:else}
						<form onsubmit={handleDisable} class="space-y-6">
							<Alert class="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
								<AlertTriangleIcon class="size-4" />
								<AlertDescription>
									<strong>Warning:</strong> Disabling 2FA will make your account less secure.
								</AlertDescription>
							</Alert>

							{#if disable2faMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{disable2faMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<div class="space-y-3">
								<Label for="disable-code">Enter your authenticator code</Label>
								<InputOTP.Root
									maxlength={6}
									bind:value={verificationCode}
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

							<div class="flex gap-3">
								<Button variant="outline" class="flex-1" href="/settings/security">
									Cancel
								</Button>
								<Button
									type="submit"
									variant="destructive"
									class="flex-1"
									disabled={verificationCode.length !== 6 || disable2faMutation.isPending}
								>
									{disable2faMutation.isPending ? "Disabling..." : "Disable 2FA"}
								</Button>
							</div>
						</form>
					{/if}
				{:else}
					{#if user.twoFactorEnabled}
						<Alert class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
							<CheckCircleIcon class="size-4" />
							<AlertDescription>
								Two-factor authentication is already enabled on your account.
								<a
									href="/settings/security"
									class="mt-2 block font-medium underline hover:no-underline"
								>
									Return to security settings
								</a>
							</AlertDescription>
						</Alert>
					{:else if step === "initial"}
						<div class="space-y-6">
							<div class="text-center">
								<div class="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
									<ShieldIcon class="size-8 text-primary" />
								</div>
								<h3 class="mt-4 text-lg font-medium">Protect your account</h3>
								<p class="mt-2 text-sm text-muted-foreground">
									Two-factor authentication adds an extra layer of security. You'll need to enter a
									code from your authenticator app when signing in.
								</p>
							</div>

							<div class="rounded-lg bg-muted p-4">
								<h4 class="text-sm font-medium">You'll need an authenticator app</h4>
								<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
									<li>• Google Authenticator</li>
									<li>• Microsoft Authenticator</li>
									<li>• Authy</li>
									<li>• 1Password</li>
								</ul>
							</div>

							{#if enable2faMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{enable2faMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<Button class="w-full" onclick={handleEnableSetup} disabled={enable2faMutation.isPending}>
								{enable2faMutation.isPending ? "Setting up..." : "Begin Setup"}
							</Button>
						</div>
					{:else if step === "verify" && qrData}
						<form onsubmit={handleVerifyAndEnable} class="space-y-6">
							<div class="text-center">
								<h3 class="text-lg font-medium">Scan this QR code</h3>
								<p class="mt-1 text-sm text-muted-foreground">
									Use your authenticator app to scan the QR code below
								</p>
							</div>

							<div class="flex justify-center">
								<div class="rounded-lg border bg-white p-4 shadow-inner">
									<img src={qrData.qrCodeUrl} alt="QR Code for 2FA setup" class="size-48" />
								</div>
							</div>

							<div class="rounded-lg bg-muted p-4">
								<p class="text-sm font-medium">Can't scan the code? Enter this key manually:</p>
								<code class="mt-2 block break-all rounded bg-background p-2 text-center font-mono text-sm">
									{qrData.secret}
								</code>
							</div>

							{#if verify2faMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{verify2faMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<div class="space-y-3">
								<Label for="verify-code">Enter verification code</Label>
								<InputOTP.Root
									maxlength={6}
									bind:value={verificationCode}
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
									Enter the 6-digit code from your authenticator app to verify setup
								</p>
							</div>

							<div class="flex gap-3">
								<Button
									type="button"
									variant="outline"
									class="flex-1"
									onclick={() => {
										step = "initial";
										qrData = null;
										verificationCode = "";
									}}
								>
									Back
								</Button>
								<Button
									type="submit"
									class="flex-1"
									disabled={verificationCode.length !== 6 || verify2faMutation.isPending}
								>
									{verify2faMutation.isPending ? "Verifying..." : "Verify & Enable"}
								</Button>
							</div>
						</form>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
