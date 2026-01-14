<script lang="ts">
  import { createLogoutMutation, createMeQuery } from "$lib/queries/auth";
  import { goto } from "$app/navigation";

  const meQuery = createMeQuery();
  const logoutMutation = createLogoutMutation();

  async function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        goto("/auth/login");
      },
    });
  }
</script>

<svelte:head>
  <title>Settings | ft_transcendence</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      <p class="mt-1 text-sm text-gray-600">
        Manage your account preferences and security
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
          access settings.
        </p>
      </div>
    {:else if meQuery.data}
      {@const user = meQuery.data}

      <div class="mb-6 overflow-hidden rounded-lg bg-white shadow">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center">
            {#if user.avatarUrl}
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                class="h-16 w-16 rounded-full"
              />
            {:else}
              <div
                class="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-medium text-indigo-600"
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            {/if}
            <div class="ml-4">
              <h2 class="text-lg font-medium text-gray-900">
                {user.displayName}
              </h2>
              <p class="text-sm text-gray-500">{user.email}</p>
              <div class="mt-1 flex items-center gap-2">
                {#if user.emailVerified}
                  <span
                    class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                  >
                    Verified
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                  >
                    Unverified
                  </span>
                {/if}
                {#if user.twoFactorEnabled}
                  <span
                    class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                  >
                    2FA
                  </span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <a
          href="/settings/security"
          class="block overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md"
        >
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100"
                >
                  <svg
                    class="h-6 w-6 text-indigo-600"
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
                <div class="ml-4">
                  <h3 class="text-sm font-medium text-gray-900">Security</h3>
                  <p class="text-sm text-gray-500">
                    Password, 2FA, and connected accounts
                  </p>
                </div>
              </div>
              <svg
                class="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </a>

        <div class="pt-4">
          <button
            type="button"
            onclick={handleLogout}
            disabled={logoutMutation.isPending}
            class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if logoutMutation.isPending}
              Signing out...
            {:else}
              Sign Out
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
