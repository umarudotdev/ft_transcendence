<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import {
		createDisable2faMutation,
		createEnable2faMutation,
		createMeQuery,
		createVerify2faMutation,
		type Enable2faResponse
	} from '$lib/queries/auth';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ShieldOffIcon from '@lucide/svelte/icons/shield-off';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';

	const meQuery = createMeQuery();
	const enable2faMutation = createEnable2faMutation();
	const verify2faMutation = createVerify2faMutation();
	const disable2faMutation = createDisable2faMutation();

	const action = $derived($page.url.searchParams.get('action'));
	const isDisableMode = $derived(action === 'disable');

	let verificationCode = $state('');
	let qrData = $state<{ qrCodeUrl: string; secret: string } | null>(null);
	let step = $state<'initial' | 'verify'>('initial');
	let successMessage = $state('');

	async function handleEnableSetup() {
		enable2faMutation.mutate(undefined, {
			onSuccess: (data: Enable2faResponse) => {
				qrData = {
					qrCodeUrl: data.qrCodeUrl,
					secret: data.secret
				};
				step = 'verify';
			}
		});
	}

	async function handleVerifyAndEnable(e: Event) {
		e.preventDefault();
		if (verificationCode.length !== 6) return;

		verify2faMutation.mutate(
			{ code: verificationCode },
			{
				onSuccess: () => {
					successMessage = m.twofa_enable_success();
					setTimeout(() => {
						goto('/settings/security');
					}, 2000);
				}
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
					successMessage = m.twofa_disable_success();
					setTimeout(() => {
						goto('/settings/security');
					}, 2000);
				}
			}
		);
	}
</script>

<svelte:head>
	<title>
		{isDisableMode ? m.twofa_disable_title() : m.twofa_enable_title()} | ft_transcendence
	</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<a
		href="/settings/security"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		{m.twofa_back_to_security()}
	</a>

	{#if meQuery.isPending}
		<Card.Root>
			<Card.Header class="text-center">
				<Skeleton class="mx-auto mb-2 h-14 w-14 rounded-full" />
				<Skeleton class="mx-auto mb-2 h-6 w-48" />
				<Skeleton class="mx-auto h-4 w-64" />
			</Card.Header>
			<Card.Content>
				<Skeleton class="mx-auto h-12 w-full" />
			</Card.Content>
		</Card.Root>
	{:else if meQuery.error}
		<Alert variant="destructive">
			<AlertTriangleIcon class="size-4" />
			<AlertDescription>
				{m.twofa_login_required()}
			</AlertDescription>
		</Alert>
	{:else if meQuery.data}
		{@const user = meQuery.data}

		{#if successMessage}
			<Card.Root>
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<CheckCircleIcon class="size-7 text-green-600 dark:text-green-400" />
					</div>
					<Card.Title class="text-xl">{m.twofa_success_title()}</Card.Title>
					<Card.Description>{successMessage}</Card.Description>
				</Card.Header>
				<Card.Content>
					<p class="text-center text-sm text-muted-foreground">
						{m.twofa_redirecting()}
					</p>
				</Card.Content>
			</Card.Root>
		{:else if isDisableMode}
			<Card.Root>
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10"
					>
						<ShieldOffIcon class="size-7 text-destructive" />
					</div>
					<Card.Title class="text-xl">{m.twofa_disable_title()}</Card.Title>
					<Card.Description>{m.twofa_disable_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if !user.twoFactorEnabled}
						<Alert>
							<AlertTriangleIcon class="size-4" />
							<AlertDescription>
								{m.twofa_disable_not_enabled()}
							</AlertDescription>
						</Alert>
					{:else}
						<form onsubmit={handleDisable} class="space-y-6">
							<Alert
								class="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
							>
								<AlertTriangleIcon class="size-4" />
								<AlertDescription>
									<strong>{m.twofa_disable_warning()}</strong>
								</AlertDescription>
							</Alert>

							{#if disable2faMutation.error}
								<Alert variant="destructive">
									<AlertTriangleIcon class="size-4" />
									<AlertDescription>{disable2faMutation.error.message}</AlertDescription>
								</Alert>
							{/if}

							<div class="flex justify-center">
								<InputOTP.Root
									maxlength={6}
									bind:value={verificationCode}
									onComplete={() => {
										if (verificationCode.length === 6 && !disable2faMutation.isPending) {
											handleDisable(new Event('submit'));
										}
									}}
									disabled={disable2faMutation.isPending}
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

							<div class="flex gap-3">
								<Button variant="outline" class="flex-1" href="/settings/security">{m.common_cancel()}</Button>
								<Button
									type="submit"
									variant="destructive"
									class="flex-1"
									disabled={verificationCode.length !== 6 || disable2faMutation.isPending}
								>
									{disable2faMutation.isPending ? m.twofa_disabling() : m.twofa_disable_button()}
								</Button>
							</div>
						</form>
					{/if}
				</Card.Content>
			</Card.Root>
		{:else if user.twoFactorEnabled}
			<Card.Root>
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<ShieldCheckIcon class="size-7 text-green-600 dark:text-green-400" />
					</div>
					<Card.Title class="text-xl">{m.twofa_already_enabled_title()}</Card.Title>
					<Card.Description
						>{m.twofa_already_enabled_description()}</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<Button variant="outline" class="w-full" href="/settings/security">
						<ArrowLeftIcon class="mr-2 size-4" />
						{m.twofa_return_to_security()}
					</Button>
				</Card.Content>
			</Card.Root>
		{:else if step === 'initial'}
			<Card.Root>
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10"
					>
						<ShieldIcon class="size-7 text-primary" />
					</div>
					<Card.Title class="text-xl">{m.twofa_enable_title()}</Card.Title>
					<Card.Description>{m.twofa_enable_description()}</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<p class="text-center text-sm text-muted-foreground">
						{m.twofa_enable_info()}
					</p>

					<div class="rounded-lg bg-muted p-4">
						<h4 class="text-sm font-medium">{m.twofa_supported_apps()}</h4>
						<ul class="mt-2 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
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
						{enable2faMutation.isPending ? m.twofa_setting_up() : m.twofa_begin_setup()}
					</Button>
				</Card.Content>
			</Card.Root>
		{:else if step === 'verify' && qrData}
			<Card.Root>
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10"
					>
						<QrCodeIcon class="size-7 text-primary" />
					</div>
					<Card.Title class="text-xl">{m.twofa_scan_title()}</Card.Title>
					<Card.Description>{m.twofa_scan_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleVerifyAndEnable} class="space-y-6">
						<div class="flex justify-center">
							<div class="rounded-xl border-2 bg-white p-3">
								<img src={qrData.qrCodeUrl} alt="QR Code for 2FA setup" class="size-44" />
							</div>
						</div>

						<details class="rounded-lg bg-muted">
							<summary class="cursor-pointer p-3 text-sm font-medium"
								>{m.twofa_manual_entry()}</summary
							>
							<div class="border-t px-3 pt-2 pb-3">
								<code
									class="block rounded bg-background p-2 text-center font-mono text-xs break-all select-all"
								>
									{qrData.secret}
								</code>
							</div>
						</details>

						{#if verify2faMutation.error}
							<Alert variant="destructive">
								<AlertTriangleIcon class="size-4" />
								<AlertDescription>{verify2faMutation.error.message}</AlertDescription>
							</Alert>
						{/if}

						<div class="space-y-3">
							<p class="text-center text-sm font-medium">{m.twofa_enter_code()}</p>
							<div class="flex justify-center">
								<InputOTP.Root
									maxlength={6}
									bind:value={verificationCode}
									onComplete={() => {
										if (verificationCode.length === 6 && !verify2faMutation.isPending) {
											handleVerifyAndEnable(new Event('submit'));
										}
									}}
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
						</div>

						<div class="flex gap-3">
							<Button
								type="button"
								variant="ghost"
								class="flex-1 gap-2"
								onclick={() => {
									step = 'initial';
									qrData = null;
									verificationCode = '';
								}}
							>
								<ArrowLeftIcon class="size-4" />
								{m.common_back()}
							</Button>
							<Button
								type="submit"
								class="flex-1"
								disabled={verificationCode.length !== 6 || verify2faMutation.isPending}
							>
								{verify2faMutation.isPending ? m.twofa_verifying() : m.twofa_enable_button()}
							</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</div>
