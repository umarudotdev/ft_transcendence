<script lang="ts">
	import { getDebugStore } from '$lib/stores/debug.svelte';
	import { getGameStore } from '$lib/stores/game.svelte';

	const debug = getDebugStore();
	const game = getGameStore();

	const INTERPOLATION_DELAY_MS = 100;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'F3') {
			e.preventDefault();
			debug.toggle();
		}
	}

	function radToDeg(rad: number): number {
		return ((rad * 180) / Math.PI) % 360;
	}

	function formatCooldown(cooldownUntil: number, currentTick: number): string {
		const remaining = Math.max(0, cooldownUntil - currentTick);
		return remaining > 0 ? `${remaining}t` : 'ready';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if debug.visible}
	{@const player = game.getMyPlayer()}
	{@const spellActive = game.spellCardDeclarer !== ''}
	{@const spellRemaining = Math.max(0, game.spellCardEndsAtTick - game.gameTick)}
	<div class="pointer-events-none absolute inset-0 z-50">
		<div
			class="pointer-events-auto absolute right-2 top-2 w-56 rounded border border-white/10 bg-black/80 p-2 font-mono text-[10px] leading-tight text-green-400 shadow-lg backdrop-blur-sm"
		>
			<!-- Perf -->
			<div class="mb-1 text-[9px] font-bold uppercase tracking-wider text-green-300">Perf</div>
			<div class="grid grid-cols-2 gap-x-2">
				<span class="text-white/50">FPS</span>
				<span>{debug.fps.toFixed(1)}</span>
				<span class="text-white/50">Frame</span>
				<span>{debug.frameTime.toFixed(2)}ms</span>
				<span class="text-white/50">Bullets</span>
				<span>{debug.bulletCount}</span>
				<span class="text-white/50">Particles</span>
				<span>{debug.particleCount}</span>
				<span class="text-white/50">Effects</span>
				<span>{debug.effectCount}</span>
			</div>

			<!-- Player -->
			<div class="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wider text-green-300">
				Player
			</div>
			{#if player}
				<div class="grid grid-cols-2 gap-x-2">
					<span class="text-white/50">Pos</span>
					<span>{player.x.toFixed(0)}, {player.y.toFixed(0)}</span>
					<span class="text-white/50">Aim</span>
					<span>{radToDeg(player.aimAngle).toFixed(1)}&deg;</span>
					<span class="text-white/50">HP</span>
					<span>{player.hp}</span>
					<span class="text-white/50">Lives</span>
					<span>{player.lives}</span>
					<span class="text-white/50">Score</span>
					<span>{player.score}</span>
					<span class="text-white/50">Ability 1</span>
					<span>{formatCooldown(player.ability1CooldownUntil, game.gameTick)}</span>
					<span class="text-white/50">Ability 2</span>
					<span>{formatCooldown(player.ability2CooldownUntil, game.gameTick)}</span>
					<span class="text-white/50">Ultimate</span>
					<span>{player.ultimateCharge.toFixed(0)}%</span>
					<span class="text-white/50">Flags</span>
					<span>
						{#if player.isFocusing}F{/if}{#if player.isDashing}D{/if}{#if player.isShielded}S{/if}{#if player.invincibleUntil > game.gameTick}I{/if}
					</span>
				</div>
			{:else}
				<div class="text-white/30">No player</div>
			{/if}

			<!-- Network -->
			<div class="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wider text-green-300">
				Network
			</div>
			<div class="grid grid-cols-2 gap-x-2">
				<span class="text-white/50">Tick</span>
				<span>{debug.serverTick}</span>
				<span class="text-white/50">Patches/s</span>
				<span>{debug.patchesPerSecond}</span>
				<span class="text-white/50">Interp</span>
				<span>{INTERPOLATION_DELAY_MS}ms</span>
			</div>

			<!-- Game -->
			<div class="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wider text-green-300">
				Game
			</div>
			<div class="grid grid-cols-2 gap-x-2">
				<span class="text-white/50">Phase</span>
				<span>{game.phase}</span>
				<span class="text-white/50">Spell Card</span>
				<span>{spellActive ? `${spellRemaining}t` : 'no'}</span>
				<span class="text-white/50">Players</span>
				<span>{game.players.size}</span>
			</div>

			<div class="mt-2 text-center text-[8px] text-white/20">F3 to close</div>
		</div>
	</div>
{/if}
