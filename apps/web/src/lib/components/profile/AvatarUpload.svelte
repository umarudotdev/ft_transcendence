<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { m } from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { getInitials } from '$lib/utils';

	interface Props {
		avatarUrl: string | null;
		displayName: string;
		onUpload: (file: File) => Promise<void>;
		onRemove?: () => Promise<void>;
		loading?: boolean;
		editable?: boolean;
	}

	let {
		avatarUrl,
		displayName,
		onUpload,
		onRemove,
		loading = false,
		editable = true
	}: Props = $props();

	let isRemoving = $state(false);

	let fileInput: HTMLInputElement | undefined = $state();
	let previewUrl = $state<string | null>(null);

	function handleClick() {
		if (editable && !loading) {
			fileInput?.click();
		}
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			toast.error(m.avatar_invalid_type());
			return;
		}

		// Validate file size (2MB)
		const maxSize = 2 * 1024 * 1024;
		if (file.size > maxSize) {
			toast.error(m.avatar_too_large());
			return;
		}

		// Create preview
		previewUrl = URL.createObjectURL(file);

		try {
			await onUpload(file);
			toast.success(m.avatar_updated());
		} catch (error) {
			const message = error instanceof Error ? error.message : m.avatar_upload_failed();
			toast.error(message);
			previewUrl = null;
		} finally {
			// Clear the input
			target.value = '';
		}
	}

	async function handleRemove(event: Event) {
		event.stopPropagation();
		if (!onRemove || isRemoving) return;

		isRemoving = true;
		try {
			await onRemove();
			previewUrl = null;
			toast.success(m.avatar_removed());
		} catch (error) {
			const message = error instanceof Error ? error.message : m.avatar_remove_failed();
			toast.error(message);
		} finally {
			isRemoving = false;
		}
	}

	// Cleanup preview URL on unmount
	$effect(() => {
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	});
</script>

<div class="relative inline-block">
	<button
		type="button"
		onclick={handleClick}
		disabled={loading || isRemoving || !editable}
		class="group relative cursor-pointer disabled:cursor-default"
		aria-label={editable ? m.avatar_change_label() : m.avatar_user_label()}
	>
		<Avatar class="h-24 w-24 sm:h-32 sm:w-32">
			{#if previewUrl || avatarUrl}
				<AvatarImage src={previewUrl ?? avatarUrl ?? undefined} alt={displayName} />
			{/if}
			<AvatarFallback class="text-2xl sm:text-3xl">
				{getInitials(displayName)}
			</AvatarFallback>
		</Avatar>

		{#if editable}
			<div
				class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
		{/if}

		{#if loading || isRemoving}
			<div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"
				></div>
			</div>
		{/if}
	</button>

	{#if editable && onRemove && avatarUrl && !loading && !isRemoving}
		<button
			type="button"
			onclick={handleRemove}
			class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"
			aria-label={m.avatar_remove_label()}
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		class="hidden"
		onchange={handleFileChange}
	/>
</div>

{#if editable}
	<p class="mt-2 text-xs text-muted-foreground">{m.avatar_upload_hint()}</p>
{/if}
