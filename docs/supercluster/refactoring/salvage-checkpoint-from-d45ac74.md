# SuperCluster Salvage Checkpoint (From `d45ac74`)

Date: 2026-02-11  
Baseline anchor: `d45ac74` (`refactor(supercluster): add fixed-step simulation and normalize projectile terminology in docs`)

## Purpose

Document what is already working and worth keeping from `d45ac74..HEAD`, and what is most likely causing current movement/render instability.

This is a rework aid, not a final architecture spec.

## Confirmed Good (Keep)

1. WebSocket connection path and dev proxy setup
- `apps/web/src/routes/(app)/game/+page.svelte`
- `apps/web/vite.config.ts`
- Result: game WS can connect and messages can flow in dev.

Example (page wiring that worked):
```ts
import { browser } from "$app/environment";

const wsUrl = browser
  ? import.meta.env.DEV
    ? "ws://localhost:3000/api/game/ws"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/game/ws`
  : "";
```

And pass it:
```svelte
<SuperCluster debug={true} {wsUrl} />
```

Example (Vite proxy requirement for WS upgrade):
```ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
      ws: true
    }
  }
}
```

2. API game WS runtime/controller plumbing
- `apps/api/src/modules/game/game.controller.ts`
- `apps/api/src/modules/game/game.runtime.service.ts`
- Result: server receives/handles input messages and can broadcast snapshots/events.

Example (controller forwards socket and payload):
```ts
message(ws, message) {
  GameRuntimeService.handleClientMessage(
    ws.raw as unknown as WebSocket,
    message
  );
}
```

Example (runtime parser accepts string/object):
```ts
let parsed: ClientMessage | null = null;
if (typeof message === "string") {
  parsed = JSON.parse(message) as ClientMessage;
} else if (message && typeof message === "object") {
  parsed = message as ClientMessage;
}
if (!parsed) return;
```

Example (ready reset that worked):
```ts
case "ready":
  this.simulationState = createInitialServerSimulationState();
  this.lastProcessedInputSeq = 0;
  this.broadcastState();
  break;
```

3. Shared collision primitives in package
- `packages/supercluster/src/simulation/collision.ts`
- `checkSphereCollision`, `checkSphereCollisionFast`, angular radius helpers.

4. Numeric safety guards
- EPS/zero-angle guards in shared movement/render matrix updates reduce NaN/degenerate edge cases.

## High-Risk / Likely Source Of Weird Movement

1. Ship orientation reconstruction from spherical in renderer
- `apps/web/src/lib/supercluster/renderer/GameRenderer.ts` (`updateState(...)`)
- Current path rebuilds world rotation with fixed X/Y axis-angle offsets from `phi/theta`.
- This is the primary suspect for axis/pole/reference-frame odd behavior.

2. Representation hop in authority path
- Server simulation is vector-first internally.
- Network ship state + renderer conversion/reconstruction reintroduce frame ambiguity.

3. Hybrid authority behavior during transition
- Local + server authority paths both exist.
- This can hide/compound frame bugs and make behavior inconsistent across runs.

## What Is Probably Not The Root Cause

1. Collision helper functions alone (`checkSphereCollision*`).
2. EPS correction in projectile/asteroid matrix updates.
3. `moveOnSphere` angle/EPS guards by themselves.

These are mostly defensive/stability changes, not control-frame ownership changes.

## Practical Rework Strategy (Minimal Risk)

1. Freeze known-good infra
- Keep WS/proxy/runtime messaging files as-is.
- Do not rework transport while fixing movement math.

2. Isolate movement frame contract
- Define one canonical frame contract for ship/world mapping.
- Validate with 4-direction parity checks (`W`, `A`, `S`, `D`) on server-state -> renderer-state application.

3. Fix renderer authoritative apply path first
- Focus only on `GameRenderer.updateState(...)` ship/world transform logic.
- Avoid touching collision/projectile logic in the same step.

4. Re-validate collisions after movement is stable
- Only after ship/world frame is correct, revisit collision sync/resolution path.

5. Keep math/performance work separate
- Do not optimize while behavior correctness is unresolved.

## Must-Have Checklist When Replaying On Older Commit

If rolling back to `d45ac74`, re-apply these in this order:

1. WS URL wiring in game page
- Build `wsUrl` for dev/prod and pass to `SuperCluster`.

2. Vite WS proxy flag
- Ensure `/api` proxy has `ws: true`.

3. Controller runtime call signature
- `handleClientMessage(ws, message)` (socket identity included).

4. Runtime message parser
- Accept both string/object payload forms.
- Ignore invalid JSON without crashing.

5. Runtime ready/reset flow
- Reset sim/input/seq and immediately broadcast state snapshot.

6. Runtime connection hygiene
- Register/unregister clients cleanly.
- Skip/cleanup closed sockets during broadcasts.

7. Type check after each replay step
- `cd apps/api && bun run tsc --noEmit`
- `cd apps/web && bun run check`

## Pitfalls To Avoid During Rework

1. Mixing coordinate conventions silently (`+Z` front vs other assumptions).
2. Changing both transport contract and transform math in one commit.
3. Validating “works locally” without checking server-authority mode specifically.
4. Touching renderer local fallback mechanics while debugging server snapshot apply.

## Why These WS Pieces Matter

1. `wsUrl` path decides whether game actually reaches API websocket.
2. Proxy `ws: true` decides whether upgrade requests are forwarded in dev.
3. Runtime parser flexibility avoids silent input drops due to transport payload shape.
4. `ready` reset gives a deterministic state boundary for rejoin/restart.

Without these, movement debugging is noisy because transport itself is unstable.

## Suggested Commit Discipline

1. `fix(supercluster): stabilize ws path and runtime input handling` (already done)
2. `fix(supercluster): lock authoritative ship/world frame mapping`
3. `fix(supercluster): restore collision behavior after frame contract`
4. `refactor(supercluster): continue authority split phases`
