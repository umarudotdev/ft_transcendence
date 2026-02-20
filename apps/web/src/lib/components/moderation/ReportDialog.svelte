<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import {
		createSubmitReportMutation,
		getReasonText,
		type ReportReason
	} from '$lib/queries/moderation';
	import { toast } from 'svelte-sonner';
	import FlagIcon from '@lucide/svelte/icons/flag';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		open: boolean;
		userId: number;
		userName: string;
		matchId?: number;
		onClose: () => void;
	}

	let { open = $bindable(), userId, userName, matchId, onClose }: Props = $props();

	const reportMutation = createSubmitReportMutation();

	let selectedReason: string | undefined = $state(undefined);
	let description = $state('');

	const reasons: ReportReason[] = ['afk', 'cheating', 'harassment', 'inappropriate_name', 'other'];

	async function handleSubmit() {
		if (!selectedReason) {
			toast.error(m.report_select_reason());
			return;
		}

		try {
			await reportMutation.mutateAsync({
				reportedUserId: userId,
				reason: selectedReason as ReportReason,
				description: description.trim() || undefined,
				matchId
			});
			toast.success(m.report_submitted());
			handleClose();
		} catch (error) {
			const message = error instanceof Error ? error.message : m.report_submit_failed();
			toast.error(message);
		}
	}

	function handleClose() {
		selectedReason = undefined;
		description = '';
		onClose();
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<FlagIcon class="size-5" />
				{m.report_title()}
			</DialogTitle>
			<DialogDescription>
				{m.report_description({ name: userName })}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="reason">{m.report_reason_label()}</Label>
				<Select.Root type="single" bind:value={selectedReason}>
					<Select.Trigger id="reason">
						{#if selectedReason}
							{getReasonText(selectedReason as ReportReason)}
						{:else}
							<span class="text-muted-foreground">{m.report_reason_placeholder()}</span>
						{/if}
					</Select.Trigger>
					<Select.Content>
						{#each reasons as reason}
							<Select.Item value={reason}>
								{getReasonText(reason)}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-2">
				<Label for="description">{m.report_details_label()}</Label>
				<Textarea
					id="description"
					bind:value={description}
					placeholder={m.report_details_placeholder()}
					rows={4}
					maxlength={500}
				/>
				<p class="text-xs text-muted-foreground">
					{m.report_characters({ count: description.length })}
				</p>
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={handleClose}>{m.common_cancel()}</Button>
			<Button onclick={handleSubmit} disabled={reportMutation.isPending || !selectedReason}>
				{#if reportMutation.isPending}
					{m.report_submitting()}
				{:else}
					{m.report_submit()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
