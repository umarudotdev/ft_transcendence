<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    createChangePasswordMutation,
    createMeQuery,
    redirectToLink42,
  } from "$lib/queries/auth";

  const meQuery = createMeQuery();
  const changePasswordMutation = createChangePasswordMutation();

  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let successMessage = $state("");

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
          // Redirect to login after a short delay
          setTimeout(() => {
            goto("/auth/login?message=Password changed. Please log in again.");
          }, 2000);
        },
      }
    );
  }
</script>

<svelte:head>
  <title>Security Settings | ft_transcendence</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
    <div class="mb-8">
      <a
        href="/settings"
        class="text-sm text-indigo-600 hover:text-indigo-500"
      >
        &larr; Back to Settings
      </a>
      <h1 class="mt-4 text-2xl font-bold text-gray-900">Security Settings</h1>
      <p class="mt-1 text-sm text-gray-600">
        Manage your account security settings
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
          access security settings.
        </p>
      </div>
    {:else if meQuery.data}
      {@const user = meQuery.data}
      <div class="space-y-6">
        <div class="overflow-hidden rounded-lg bg-white shadow">
          <div class="px-4 py-5 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900">Change Password</h2>
            <p class="mt-1 text-sm text-gray-500">
              Update your password to keep your account secure
            </p>

            {#if user.intraId && !user.email}
              <p class="mt-4 text-sm text-gray-600">
                You signed up with 42 OAuth and don't have a password set. To
                add password authentication, please contact support.
              </p>
            {:else}
              <form onsubmit={handleChangePassword} class="mt-6 space-y-4">
                {#if successMessage}
                  <div class="rounded-md bg-green-50 p-4">
                    <p class="text-sm text-green-800">{successMessage}</p>
                  </div>
                {/if}

                {#if changePasswordMutation.error}
                  <div class="rounded-md bg-red-50 p-4">
                    <p class="text-sm text-red-800">
                      {changePasswordMutation.error.message}
                    </p>
                  </div>
                {/if}

                <div>
                  <label
                    for="current-password"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="current-password"
                    bind:value={currentPassword}
                    required
                    autocomplete="current-password"
                    class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    for="new-password"
                    class="block text-sm font-medium text-gray-700"
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    id="new-password"
                    bind:value={newPassword}
                    required
                    autocomplete="new-password"
                    class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    for="confirm-password"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirm-password"
                    bind:value={confirmPassword}
                    required
                    autocomplete="new-password"
                    class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                {#if newPassword.length > 0}
                  <div class="rounded-md bg-gray-50 p-4">
                    <p class="text-sm font-medium text-gray-700">
                      Password requirements:
                    </p>
                    <ul class="mt-2 space-y-1 text-sm">
                      <li
                        class={passwordRequirements.minLength
                          ? "text-green-600"
                          : "text-gray-500"}
                      >
                        {passwordRequirements.minLength ? "✓" : "○"} At least 8 characters
                      </li>
                      <li
                        class={passwordRequirements.hasUpper
                          ? "text-green-600"
                          : "text-gray-500"}
                      >
                        {passwordRequirements.hasUpper ? "✓" : "○"} One uppercase
                        letter
                      </li>
                      <li
                        class={passwordRequirements.hasLower
                          ? "text-green-600"
                          : "text-gray-500"}
                      >
                        {passwordRequirements.hasLower ? "✓" : "○"} One lowercase
                        letter
                      </li>
                      <li
                        class={passwordRequirements.hasNumber
                          ? "text-green-600"
                          : "text-gray-500"}
                      >
                        {passwordRequirements.hasNumber ? "✓" : "○"} One number
                      </li>
                      <li
                        class={passwordRequirements.passwordsMatch
                          ? "text-green-600"
                          : "text-gray-500"}
                      >
                        {passwordRequirements.passwordsMatch ? "✓" : "○"} Passwords
                        match
                      </li>
                    </ul>
                  </div>
                {/if}

                <button
                  type="submit"
                  disabled={!isPasswordValid || changePasswordMutation.isPending}
                  class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {#if changePasswordMutation.isPending}
                    Changing Password...
                  {:else}
                    Change Password
                  {/if}
                </button>
              </form>
            {/if}
          </div>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow">
          <div class="px-4 py-5 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900">42 Account</h2>
            <p class="mt-1 text-sm text-gray-500">
              Link your 42 account for quick sign-in
            </p>

            <div class="mt-6">
              {#if user.intraId}
                <div class="flex items-center">
                  <span
                    class="inline-flex items-center rounded-full bg-green-100 px-3 py-0.5 text-sm font-medium text-green-800"
                  >
                    <svg
                      class="-ml-1 mr-1.5 h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    42 Account Linked
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-600">
                  Your 42 account is connected. You can use it to sign in.
                </p>
              {:else}
                <button
                  type="button"
                  onclick={redirectToLink42}
                  class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    />
                  </svg>
                  Link 42 Account
                </button>
              {/if}
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow">
          <div class="px-4 py-5 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900">
              Two-Factor Authentication
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Add an extra layer of security to your account
            </p>

            <div class="mt-6">
              {#if user.twoFactorEnabled}
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <span
                      class="inline-flex items-center rounded-full bg-green-100 px-3 py-0.5 text-sm font-medium text-green-800"
                    >
                      <svg
                        class="-ml-1 mr-1.5 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      2FA Enabled
                    </span>
                  </div>
                  <a
                    href="/settings/2fa?action=disable"
                    class="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Disable 2FA
                  </a>
                </div>
                <p class="mt-2 text-sm text-gray-600">
                  Your account is protected with two-factor authentication.
                </p>
              {:else}
                <a
                  href="/settings/2fa"
                  class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg class="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Enable 2FA
                </a>
                <p class="mt-2 text-sm text-gray-600">
                  Protect your account with time-based one-time passwords
                  (TOTP).
                </p>
              {/if}
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow">
          <div class="px-4 py-5 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900">Active Sessions</h2>
            <p class="mt-1 text-sm text-gray-500">
              Sign out from all devices if you suspect unauthorized access
            </p>

            <div class="mt-6">
              <a
                href="/auth/logout?all=true"
                class="inline-flex items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <svg
                  class="mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out All Devices
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
