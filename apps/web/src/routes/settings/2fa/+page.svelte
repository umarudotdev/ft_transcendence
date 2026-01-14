<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    createDisable2faMutation,
    createEnable2faMutation,
    createMeQuery,
    createVerify2faMutation,
    type Enable2faResponse,
  } from "$lib/queries/auth";

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
          successMessage =
            "Two-factor authentication enabled successfully!";
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

  function formatCodeInput(value: string): string {
    return value.replace(/\D/g, "").slice(0, 6);
  }

  function handleCodeInput(e: Event) {
    const target = e.target as HTMLInputElement;
    verificationCode = formatCodeInput(target.value);
  }
</script>

<svelte:head>
  <title>
    {isDisableMode ? "Disable" : "Enable"} Two-Factor Authentication | ft_transcendence
  </title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
    <div class="mb-8">
      <a
        href="/settings/security"
        class="text-sm text-indigo-600 hover:text-indigo-500"
      >
        &larr; Back to Security Settings
      </a>
      <h1 class="mt-4 text-2xl font-bold text-gray-900">
        {isDisableMode
          ? "Disable Two-Factor Authentication"
          : "Enable Two-Factor Authentication"}
      </h1>
      <p class="mt-1 text-sm text-gray-600">
        {isDisableMode
          ? "Enter your authenticator code to disable 2FA"
          : "Secure your account with time-based one-time passwords"}
      </p>
    </div>

    {#if meQuery.isPending}
      <div class="flex justify-center py-12">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
        ></div>
      </div>
    {:else if meQuery.error}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-red-800">
          Please <a href="/auth/login" class="font-medium underline">log in</a> to
          manage 2FA settings.
        </p>
      </div>
    {:else if meQuery.data}
      {@const user = meQuery.data}
      <div class="overflow-hidden rounded-lg bg-white shadow">
        <div class="px-4 py-5 sm:p-6">
          {#if successMessage}
            <div class="rounded-md bg-green-50 p-4">
              <div class="flex">
                <svg
                  class="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p class="ml-3 text-sm text-green-800">{successMessage}</p>
              </div>
            </div>
          {:else if isDisableMode}
            {#if !user.twoFactorEnabled}
              <div class="rounded-md bg-yellow-50 p-4">
                <p class="text-sm text-yellow-800">
                  Two-factor authentication is not enabled on your account.
                </p>
              </div>
            {:else}
              <form onsubmit={handleDisable} class="space-y-6">
                <div class="rounded-md bg-yellow-50 p-4">
                  <div class="flex">
                    <svg
                      class="h-5 w-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <p class="ml-3 text-sm text-yellow-800">
                      <strong>Warning:</strong> Disabling 2FA will make your account
                      less secure.
                    </p>
                  </div>
                </div>

                {#if disable2faMutation.error}
                  <div class="rounded-md bg-red-50 p-4">
                    <p class="text-sm text-red-800">
                      {disable2faMutation.error.message}
                    </p>
                  </div>
                {/if}

                <div>
                  <label
                    for="disable-code"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Enter your authenticator code
                  </label>
                  <input
                    type="text"
                    id="disable-code"
                    value={verificationCode}
                    oninput={handleCodeInput}
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    placeholder="000000"
                    class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div class="flex gap-3">
                  <a
                    href="/settings/security"
                    class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Cancel
                  </a>
                  <button
                    type="submit"
                    disabled={verificationCode.length !== 6 ||
                      disable2faMutation.isPending}
                    class="flex-1 rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {#if disable2faMutation.isPending}
                      Disabling...
                    {:else}
                      Disable 2FA
                    {/if}
                  </button>
                </div>
              </form>
            {/if}
          {:else}
            {#if user.twoFactorEnabled}
              <div class="rounded-md bg-green-50 p-4">
                <div class="flex">
                  <svg
                    class="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <div class="ml-3">
                    <p class="text-sm text-green-800">
                      Two-factor authentication is already enabled on your
                      account.
                    </p>
                    <a
                      href="/settings/security"
                      class="mt-2 inline-block text-sm font-medium text-green-700 underline hover:text-green-600"
                    >
                      Return to security settings
                    </a>
                  </div>
                </div>
              </div>
            {:else if step === "initial"}
              <div class="space-y-6">
                <div class="text-center">
                  <div
                    class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100"
                  >
                    <svg
                      class="h-8 w-8 text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 class="mt-4 text-lg font-medium text-gray-900">
                    Protect your account
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">
                    Two-factor authentication adds an extra layer of security.
                    You'll need to enter a code from your authenticator app when
                    signing in.
                  </p>
                </div>

                <div class="rounded-md bg-gray-50 p-4">
                  <h4 class="text-sm font-medium text-gray-900">
                    You'll need an authenticator app
                  </h4>
                  <ul class="mt-2 space-y-1 text-sm text-gray-600">
                    <li>• Google Authenticator</li>
                    <li>• Microsoft Authenticator</li>
                    <li>• Authy</li>
                    <li>• 1Password</li>
                  </ul>
                </div>

                {#if enable2faMutation.error}
                  <div class="rounded-md bg-red-50 p-4">
                    <p class="text-sm text-red-800">
                      {enable2faMutation.error.message}
                    </p>
                  </div>
                {/if}

                <button
                  type="button"
                  onclick={handleEnableSetup}
                  disabled={enable2faMutation.isPending}
                  class="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {#if enable2faMutation.isPending}
                    Setting up...
                  {:else}
                    Begin Setup
                  {/if}
                </button>
              </div>
            {:else if step === "verify" && qrData}
              <form onsubmit={handleVerifyAndEnable} class="space-y-6">
                <div class="text-center">
                  <h3 class="text-lg font-medium text-gray-900">
                    Scan this QR code
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">
                    Use your authenticator app to scan the QR code below
                  </p>
                </div>

                <div class="flex justify-center">
                  <div class="rounded-lg bg-white p-4 shadow-inner">
                    <img
                      src={qrData.qrCodeUrl}
                      alt="QR Code for 2FA setup"
                      class="h-48 w-48"
                    />
                  </div>
                </div>

                <div class="rounded-md bg-gray-50 p-4">
                  <p class="text-sm font-medium text-gray-700">
                    Can't scan the code? Enter this key manually:
                  </p>
                  <code
                    class="mt-2 block break-all rounded bg-gray-200 p-2 text-center font-mono text-sm"
                  >
                    {qrData.secret}
                  </code>
                </div>

                {#if verify2faMutation.error}
                  <div class="rounded-md bg-red-50 p-4">
                    <p class="text-sm text-red-800">
                      {verify2faMutation.error.message}
                    </p>
                  </div>
                {/if}

                <div>
                  <label
                    for="verify-code"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Enter verification code
                  </label>
                  <input
                    type="text"
                    id="verify-code"
                    value={verificationCode}
                    oninput={handleCodeInput}
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    placeholder="000000"
                    class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Enter the 6-digit code from your authenticator app to verify
                    setup
                  </p>
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    onclick={() => {
                      step = "initial";
                      qrData = null;
                      verificationCode = "";
                    }}
                    class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verificationCode.length !== 6 ||
                      verify2faMutation.isPending}
                    class="flex-1 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {#if verify2faMutation.isPending}
                      Verifying...
                    {:else}
                      Verify & Enable
                    {/if}
                  </button>
                </div>
              </form>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
