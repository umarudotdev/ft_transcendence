<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime';
	import { getInitials } from '$lib/utils';
	import type { MatchHistoryItem } from '$lib/queries/users';

	interface Props {
		matches: MatchHistoryItem[];
		total: number;
		hasMore: boolean;
		loading?: boolean;
		onLoadMore?: () => void;
		onFilterChange?: (filter: string) => void;
		currentFilter?: string;
	}

	let {
		matches,
		total,
		hasMore,
		loading = false,
		onLoadMore,
		onFilterChange,
		currentFilter = 'all'
	}: Props = $props();

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat(getLocale(), {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function getResultBadgeVariant(result: 'win' | 'loss' | 'draw') {
		switch (result) {
			case 'win':
				return 'default' as const;
			case 'loss':
				return 'destructive' as const;
			case 'draw':
				return 'secondary' as const;
		}
	}
</script>

<Card>
	<CardHeader class="flex flex-row items-center justify-between pb-2">
		<CardTitle class="text-lg">{m.match_history_title()}</CardTitle>
		<div class="flex items-center gap-2">
			<Select
				type="single"
				value={currentFilter}
				onValueChange={(value) => onFilterChange?.(value ?? 'all')}
			>
				<SelectTrigger class="w-32">
					{currentFilter === 'all' ? m.match_history_all() : currentFilter === 'win' ? m.match_history_wins() : m.match_history_losses()}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">{m.match_history_all()}</SelectItem>
					<SelectItem value="win">{m.match_history_wins()}</SelectItem>
					<SelectItem value="loss">{m.match_history_losses()}</SelectItem>
				</SelectContent>
			</Select>
		</div>
	</CardHeader>
	<CardContent>
		{#if loading && matches.length === 0}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div class="flex items-center gap-4">
						<Skeleton class="h-10 w-10 rounded-full" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-1/3" />
							<Skeleton class="h-3 w-1/4" />
						</div>
						<Skeleton class="h-6 w-16" />
					</div>
				{/each}
			</div>
		{:else if matches.length === 0}
			<div class="py-8 text-center text-muted-foreground">
				<p>{m.match_history_no_matches()}</p>
				<p class="mt-1 text-sm">{m.match_history_no_matches_hint()}</p>
			</div>
		{:else}
			<div class="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{m.match_history_opponent()}</TableHead>
							<TableHead class="text-center">{m.match_history_score()}</TableHead>
							<TableHead class="text-center">{m.match_history_result()}</TableHead>
							<TableHead class="text-center">{m.match_history_duration()}</TableHead>
							<TableHead class="text-right">{m.match_history_date()}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each matches as match}
							<TableRow>
								<TableCell>
									<div class="flex items-center gap-3">
										<Avatar class="h-8 w-8">
											{#if match.opponent.avatarUrl}
												<AvatarImage
													src={match.opponent.avatarUrl}
													alt={match.opponent.displayName}
												/>
											{/if}
											<AvatarFallback class="text-xs">
												{getInitials(match.opponent.displayName)}
											</AvatarFallback>
										</Avatar>
										<div>
											<span class="font-medium">{match.opponent.displayName}</span>
											{#if match.isAiGame}
												<Badge variant="outline" class="ml-2 text-xs">AI</Badge>
											{/if}
										</div>
									</div>
								</TableCell>
								<TableCell class="text-center">
									<span class="font-mono">
										{match.playerScore} - {match.opponentScore}
									</span>
								</TableCell>
								<TableCell class="text-center">
									<Badge variant={getResultBadgeVariant(match.result)}>
										{match.result === 'win' ? m.match_result_win() : match.result === 'loss' ? m.match_result_loss() : m.match_result_draw()}
									</Badge>
								</TableCell>
								<TableCell class="text-center">
									{formatDuration(match.duration)}
								</TableCell>
								<TableCell class="text-right text-muted-foreground">
									{formatDate(match.createdAt)}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>

			<div class="space-y-3 md:hidden">
				{#each matches as match}
					<div class="flex items-center justify-between rounded-lg border p-3">
						<div class="flex items-center gap-3">
							<Avatar class="h-10 w-10">
								{#if match.opponent.avatarUrl}
									<AvatarImage src={match.opponent.avatarUrl} alt={match.opponent.displayName} />
								{/if}
								<AvatarFallback>
									{getInitials(match.opponent.displayName)}
								</AvatarFallback>
							</Avatar>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-medium">{match.opponent.displayName}</span>
									{#if match.isAiGame}
										<Badge variant="outline" class="text-xs">AI</Badge>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									{formatDate(match.createdAt)}
								</div>
							</div>
						</div>
						<div class="text-right">
							<div class="font-mono font-medium">
								{match.playerScore} - {match.opponentScore}
							</div>
							<Badge variant={getResultBadgeVariant(match.result)} class="mt-1">
								{match.result === 'win' ? m.match_result_win() : match.result === 'loss' ? m.match_result_loss() : m.match_result_draw()}
							</Badge>
						</div>
					</div>
				{/each}
			</div>

			{#if hasMore}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" onclick={() => onLoadMore?.()} disabled={loading}>
						{#if loading}
							{m.match_history_loading()}
						{:else}
							{m.match_history_load_more()}
						{/if}
					</Button>
				</div>
			{/if}

			<div class="mt-3 text-center text-sm text-muted-foreground">
				{m.match_history_showing({ count: matches.length, total })}
			</div>
		{/if}
	</CardContent>
</Card>
