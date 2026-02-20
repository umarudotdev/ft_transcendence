<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();

	let myPlayer = $derived(gameStore.getMyPlayer());
	let opponentPlayer = $derived(gameStore.getOpponentPlayer());
	let tick = $derived(gameStore.gameTick);

	function getCooldownPercent(cooldownUntil: number): number {
		if (cooldownUntil <= tick) return 100;
		const remaining = cooldownUntil - tick;
		const maxCooldown = 480;
		return Math.max(0, Math.min(100, 100 - (remaining / maxCooldown) * 100));
	}

	function isAbilityReady(cooldownUntil: number): boolean {
		return cooldownUntil <= tick;
	}

	function abilityClass(ready: boolean, readyBorder: string, readyText: string): string {
		if (ready) return `border-${readyBorder} text-${readyText}`;
		return 'border-white/20 text-white/40';
	}
</script>

{#if myPlayer}
	<div class="pointer-events-none absolute inset-0">
		<!-- My player info (bottom) -->
		<div class="absolute right-3 bottom-3 left-3 flex items-end justify-between">
			<div class="pointer-events-auto space-y-2 rounded-lg bg-black/60 p-3 backdrop-blur-sm">
				<!-- HP Bar -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-white/70">{m.game_hp()}</span>
					<div class="h-3 w-32 overflow-hidden rounded-full bg-white/10">
						<div
							class="h-full rounded-full transition-all duration-150 {myPlayer.hp > 50
								? 'bg-green-500'
								: myPlayer.hp > 25
									? 'bg-yellow-500'
									: 'bg-red-500'}"
							style="width: {myPlayer.hp}%"
						></div>
					</div>
					<span class="font-mono text-xs text-white/70">{myPlayer.hp}</span>
				</div>

				<!-- Lives -->
				<div class="flex items-center gap-1">
					<span class="text-xs font-medium text-white/70">{m.game_lives()}</span>
					<div class="flex gap-1">
						{#each Array(3) as _, i}
							<div
								class="size-3 rounded-full {i < myPlayer.lives ? 'bg-blue-400' : 'bg-white/20'}"
							></div>
						{/each}
					</div>
				</div>

				<!-- Abilities -->
				<div class="flex gap-2">
					<!-- Dash (Q) -->
					<div
						class="relative flex size-8 items-center justify-center rounded border text-xs font-bold {isAbilityReady(
							myPlayer.ability1CooldownUntil
						)
							? 'border-cyan-400 text-cyan-400'
							: 'border-white/20 text-white/40'}"
					>
						Q
						{#if !isAbilityReady(myPlayer.ability1CooldownUntil)}
							<div
								class="absolute inset-0 rounded bg-white/10"
								style="height: {100 - getCooldownPercent(myPlayer.ability1CooldownUntil)}%"
							></div>
						{/if}
					</div>

					<!-- Bomb (E) -->
					<div
						class="relative flex size-8 items-center justify-center rounded border text-xs font-bold {isAbilityReady(
							myPlayer.ability2CooldownUntil
						)
							? 'border-yellow-400 text-yellow-400'
							: 'border-white/20 text-white/40'}"
					>
						E
						{#if !isAbilityReady(myPlayer.ability2CooldownUntil)}
							<div
								class="absolute inset-0 rounded bg-white/10"
								style="height: {100 - getCooldownPercent(myPlayer.ability2CooldownUntil)}%"
							></div>
						{/if}
					</div>

					<!-- Ultimate (R) -->
					<div
						class="relative flex size-8 items-center justify-center rounded border text-xs font-bold {myPlayer.ultimateCharge >=
						100
							? 'border-purple-400 text-purple-400'
							: 'border-white/20 text-white/40'}"
					>
						R
						<div
							class="absolute right-0 bottom-0 left-0 rounded-b bg-purple-500/30"
							style="height: {myPlayer.ultimateCharge}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Score -->
			<div class="pointer-events-auto rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
				<div class="flex items-center gap-4 text-white">
					<span class="text-2xl font-bold text-blue-400">{myPlayer.score}</span>
					<span class="text-white/50">-</span>
					<span class="text-2xl font-bold text-red-400">
						{opponentPlayer?.score ?? 0}
					</span>
				</div>
			</div>
		</div>

		<!-- Opponent info (top) -->
		{#if opponentPlayer}
			<div class="absolute top-3 left-3">
				<div class="rounded-lg bg-black/60 p-2 backdrop-blur-sm">
					<div class="flex items-center gap-2">
						<span class="text-xs text-white/70">{m.game_opponent_hp()}</span>
						<div class="h-2 w-24 overflow-hidden rounded-full bg-white/10">
							<div
								class="h-full rounded-full bg-red-400 transition-all duration-150"
								style="width: {opponentPlayer.hp}%"
							></div>
						</div>
						<div class="flex gap-0.5">
							{#each Array(3) as _, i}
								<div
									class="size-2 rounded-full {i < opponentPlayer.lives
										? 'bg-red-400'
										: 'bg-white/20'}"
								></div>
							{/each}
						</div>
					</div>
					<!-- Opponent ability cooldowns -->
					<div class="mt-1.5 flex gap-1.5">
						<div
							class="relative flex size-5 items-center justify-center rounded border text-[9px] font-bold {isAbilityReady(
								opponentPlayer.ability1CooldownUntil
							)
								? 'border-cyan-400/60 text-cyan-400/60'
								: 'border-white/10 text-white/20'}"
						>
							Q
						</div>
						<div
							class="relative flex size-5 items-center justify-center rounded border text-[9px] font-bold {isAbilityReady(
								opponentPlayer.ability2CooldownUntil
							)
								? 'border-yellow-400/60 text-yellow-400/60'
								: 'border-white/10 text-white/20'}"
						>
							E
						</div>
						<div
							class="relative flex size-5 items-center justify-center rounded border text-[9px] font-bold {opponentPlayer.ultimateCharge >=
							100
								? 'border-purple-400/60 text-purple-400/60'
								: 'border-white/10 text-white/20'}"
						>
							R
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Focus mode indicator -->
		{#if myPlayer.isFocusing}
			<div class="absolute top-3 right-3">
				<div class="rounded bg-white/20 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
					{m.game_focus()}
				</div>
			</div>
		{/if}
	</div>
{/if}
