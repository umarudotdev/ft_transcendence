# Svelte Basics for SuperCluster

This document explains Svelte concepts used in SuperCluster, specifically in `SuperCluster.svelte`.

---

## Component Hierarchy

Svelte apps are built from **components** - reusable pieces of UI. Components form a tree:

```
App.svelte (root)
├── Layout.svelte
│   ├── Header.svelte
│   └── Footer.svelte
├── routes/
│   └── +page.svelte (GamePage)
│       └── SuperCluster.svelte  ← Our game component
└── ... other components
```

### Parent and Child Components

```
┌─────────────────────────────────────────┐
│  GamePage.svelte (PARENT)               │
│                                         │
│  <script>                               │
│    import SuperCluster from '...';      │
│  </script>                              │
│                                         │
│  <!-- Using the child component -->     │
│  <SuperCluster debug={true} />          │
│                                         │
└─────────────────────────────────────────┘
           │
           │ passes props DOWN
           ▼
┌─────────────────────────────────────────┐
│  SuperCluster.svelte (CHILD)            │
│                                         │
│  <script>                               │
│    let { debug = false } = $props();    │
│  </script>                              │
│                                         │
└─────────────────────────────────────────┘
```

**Key terms:**
- **Parent component** = The component that USES another component
- **Child component** = The component being USED
- **Props** = Data passed from parent to child

### C Analogy

If you're familiar with C, think of it like `#include`:

```c
// C
#include "supercluster.h"       // Import definitions
supercluster_init(canvas, true); // Use it with arguments
```

```svelte
// Svelte
import SuperCluster from './SuperCluster.svelte';  // Import component
<SuperCluster debug={true} />                       // Use it with props
```

In the end, it's like building one big program from smaller reusable pieces.

---

## Props (Component Properties)

Props are how parent components pass data to children.

### Props Flow: Child DEFINES, Parent SENDS

```
┌─────────────────────────────────────────────────────────────────┐
│  Child (SuperCluster.svelte)                                     │
│                                                                  │
│  "I ACCEPT these props:"                                         │
│    - wsUrl?: string                                              │
│    - config?: GameConfig                                         │
│    - debug?: boolean                                             │
│                                                                  │
│  interface Props {                                               │
│    wsUrl?: string;                                               │
│    config?: GameConfig;                                          │
│    debug?: boolean;                                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Props flow UP (definition)
                              │ Values flow DOWN (from parent)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Parent (+page.svelte)                                           │
│                                                                  │
│  "I SEND you: debug={true}"                                      │
│                                                                  │
│  <SuperCluster debug={true} />                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**The child defines the "API" (what it can receive).**
**The parent decides what values to send.**

### Real Example From Our Codebase

**Parent:** `apps/web/src/routes/(app)/game/+page.svelte`
```svelte
<script>
  import { SuperCluster } from '$lib/supercluster';
</script>

<div class="...">
  <SuperCluster debug={true} />  <!-- Only sends debug -->
</div>
```

**Child:** `apps/web/src/lib/supercluster/SuperCluster.svelte`
```svelte
<script>
  interface Props {
    wsUrl?: string;       // NOT received (uses default '')
    config?: GameConfig;  // NOT received (uses DEFAULT_CONFIG)
    debug?: boolean;      // RECEIVED: true
  }

  let { wsUrl = '', config = DEFAULT_CONFIG, debug = false } = $props();
</script>
```

**Currently:**
- SuperCluster **receives:** `debug={true}`
- SuperCluster **does NOT receive:** `wsUrl`, `config` (they use defaults)
- SuperCluster **sends nothing** - props only flow DOWN (parent → child)

### Defining Props (Child Side)

```svelte
<!-- SuperCluster.svelte -->
<script lang="ts">
  // Define what props this component accepts
  interface Props {
    wsUrl?: string;       // Optional (has ?)
    config?: GameConfig;  // Optional
    debug?: boolean;      // Optional
  }

  // Destructure props with defaults
  let {
    wsUrl = '',           // Default: empty string
    config = DEFAULT_CONFIG,
    debug = false
  }: Props = $props();
</script>
```

### Passing Props (Parent Side)

```svelte
<!-- GamePage.svelte -->
<script>
  import SuperCluster from '$lib/supercluster/SuperCluster.svelte';

  const myConfig = { ... };
</script>

<!-- Pass values as attributes -->
<SuperCluster
  debug={true}
  wsUrl="ws://localhost:3000"
  config={myConfig}
/>

<!-- Or with shorthand when variable name matches prop name -->
<SuperCluster {debug} {config} />
```

### Props vs Regular Variables

| Props                        | Regular Variables              |
| ---------------------------- | ------------------------------ |
| Come from parent             | Defined in this component      |
| Read-only by default         | Can be modified freely         |
| Part of component's API      | Internal implementation detail |
| `$props()`                   | `let x = ...`                  |

---

## Reactive State ($state)

Svelte 5 uses **runes** for reactivity. `$state()` creates reactive variables that trigger UI updates.

### Basic Usage

```svelte
<script>
  // Reactive - UI updates when this changes
  let count = $state(0);

  function increment() {
    count++;  // UI automatically updates!
  }
</script>

<button onclick={increment}>
  Clicked {count} times
</button>
```

### In SuperCluster

```typescript
// These trigger UI updates when changed
let connected = $state(false);
let gameState = $state<GameState | null>(null);

// When WebSocket connects:
connected = true;  // UI shows "Connected: true"

// When server sends state:
gameState = newState;  // Debug overlay updates
```

### What $state() Does NOT Do

`$state()` only tracks changes to the **Svelte variable**, not external systems:

```typescript
let renderer: GameRenderer | null = null;

// This does NOT trigger Svelte updates:
renderer.someInternalValue = 5;

// Svelte doesn't know about Three.js internals
// They are separate systems
```

```
┌──────────────────────┐    ┌──────────────────────┐
│    Svelte World      │    │   Three.js World     │
│                      │    │                      │
│  $state() vars       │    │  GameRenderer        │
│  trigger DOM update  │    │  has own render loop │
│                      │    │  (requestAnimationFrame)
└──────────────────────┘    └──────────────────────┘
         │                           │
         ▼                           ▼
    Svelte DOM                 <canvas> element
    (debug overlay)            (3D graphics)
```

They communicate via **method calls**, not reactive binding:

```typescript
renderer.setInput(inputState);  // Send data TO Three.js
renderer.getAimAngle();         // Get data FROM Three.js
```

### Two Completely Independent Loops

This is crucial to understand:

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │    Svelte World      │      │      Three.js World          │ │
│  │                      │      │                              │ │
│  │  Renders: DOM        │      │  Renders: <canvas>           │ │
│  │  (HTML elements)     │      │  (3D graphics)               │ │
│  │                      │      │                              │ │
│  │  Updates when:       │      │  Updates: 60 times/second    │ │
│  │  $state() changes    │      │  (requestAnimationFrame)     │ │
│  │                      │      │                              │ │
│  │  Example:            │      │  Example:                    │ │
│  │  debug overlay       │      │  ship, asteroids, bullets    │ │
│  │  "Connected: true"   │      │  moving on screen            │ │
│  └──────────────────────┘      └──────────────────────────────┘ │
│           │                              ▲                       │
│           │    Method calls              │                       │
│           └──────────────────────────────┘                       │
│              renderer.setInput()                                 │
│              renderer.setAimAngle()                              │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** Svelte's only job is to:
1. Capture input events (keyboard, mouse)
2. Pass them to GameRenderer via method calls
3. Update the debug overlay when `$state()` changes

**GameRenderer runs its own 60fps loop** - Svelte doesn't control it!

### What Triggers What?

```
User presses 'W'
      │
      ▼
window 'keydown' event fires
      │
      ▼
handleKeyDown() runs (in Svelte)
      │
      ├──► inputState.forward = true   ← NOT $state(), no Svelte re-render
      │
      └──► renderer.setInput(inputState)  ← Sends to GameRenderer
                    │
                    ▼
           GameRenderer stores it internally
                    │
                    ▼
           On NEXT FRAME (60fps loop):
           GameRenderer.updateLocalMovement() uses inputState
                    │
                    ▼
           Ship moves on canvas (Three.js rendered)
```

**Svelte NEVER triggers the canvas render.** GameRenderer does that 60 times per second, independently.

---

## Non-Reactive Variables

Regular variables (without `$state()`) don't trigger UI updates:

```typescript
// NOT reactive - changing this won't update UI
const inputState: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

// This is fine because:
// 1. We don't display inputState in the template
// 2. We just pass it to GameRenderer
inputState.forward = true;
renderer?.setInput(inputState);
```

Use regular variables when:
- The value is only used internally
- It's passed to external systems (Three.js)
- You don't need UI updates

---

## Lifecycle (onMount, onDestroy)

Svelte components have a lifecycle - they're created, exist, then destroyed.

### onMount

Runs **once** when the component is first added to the DOM.

```svelte
<script>
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    // DOM is now ready
    // canvas element exists
    // Safe to initialize Three.js

    const renderer = new GameRenderer(canvas);
    renderer.start();

    // Optional: return cleanup function
    return () => {
      renderer.dispose();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
```

**Why onMount?**
- DOM elements don't exist until component mounts
- `canvas` is `undefined` before mount
- Three.js needs a real canvas element

### onDestroy

Runs **once** when the component is removed from the DOM.

```svelte
<script>
  import { onDestroy } from 'svelte';

  onDestroy(() => {
    // Clean up to prevent memory leaks
    renderer?.dispose();
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>
```

**Why onDestroy?**
- Remove event listeners (prevent memory leaks)
- Stop animation loops
- Close WebSocket connections
- Dispose Three.js resources

### Lifecycle Timeline

```
Component created
        │
        ▼
┌───────────────┐
│   onMount()   │  ← Initialize everything
└───────────────┘
        │
        ▼
┌───────────────┐
│  Component    │  ← Normal operation
│  is active    │     Event handlers work
│               │     Reactive updates happen
└───────────────┘
        │
        ▼
┌───────────────┐
│  onDestroy()  │  ← Clean up everything
└───────────────┘
        │
        ▼
Component removed from DOM
```

---

## Optional Chaining (?.)

The `?.` operator safely accesses properties that might be null:

```typescript
// Without optional chaining - crashes if renderer is null
renderer.setInput(inputState);  // Error: Cannot read property 'setInput' of null

// With optional chaining - safe
renderer?.setInput(inputState);
// Equivalent to:
if (renderer !== null && renderer !== undefined) {
  renderer.setInput(inputState);
}
```

### Why We Need It

```typescript
let renderer: GameRenderer | null = null;  // Starts as null

onMount(() => {
  renderer = new GameRenderer(canvas);  // Now it's set
});

function handleKeyDown(event: KeyboardEvent) {
  // This might run before onMount completes!
  // renderer could still be null
  renderer?.setInput(inputState);  // Safe with ?.
}
```

---

## Exported Functions (Public API)

Use `export function` to expose methods to parent components:

### Child Component (SuperCluster.svelte)

```svelte
<script>
  // Private - only usable inside this component
  function connectWebSocket() { ... }

  // Public - parent can call these
  export function sendReady(): void {
    sendMessage({ type: 'ready' });
  }

  export function isConnected(): boolean {
    return connected;
  }
</script>
```

### Parent Component Usage

```svelte
<script>
  import SuperCluster from './SuperCluster.svelte';

  let game;  // Will hold reference to SuperCluster
</script>

<!-- bind:this gives us a reference to the component -->
<SuperCluster bind:this={game} />

<!-- Now we can call exported functions -->
<button onclick={() => game.sendReady()}>
  Start Game
</button>

<p>Status: {game?.isConnected() ? 'Connected' : 'Disconnected'}</p>
```

### bind:this

```svelte
<SuperCluster bind:this={game} />
```

This creates a **reference** to the component instance. Without it, you can't call the exported functions.

```
┌─────────────────────────────────────────┐
│  Parent Component                       │
│                                         │
│  let game;  ◄─────────────────────┐     │
│                                   │     │
│  <SuperCluster bind:this={game} />│     │
│                           │       │     │
│                           └───────┘     │
│                                         │
│  game.sendReady();  // Works!           │
└─────────────────────────────────────────┘
```

---

## Event Listeners

### Adding Listeners

```typescript
onMount(() => {
  // Add listeners when component mounts
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('mousemove', handleMouseMove);
});
```

### Removing Listeners

```typescript
onDestroy(() => {
  // MUST remove listeners to prevent memory leaks
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  canvas?.removeEventListener('mousemove', handleMouseMove);
});
```

### window vs canvas

```typescript
// Keys: Listen on window (works even if canvas not focused)
window.addEventListener('keydown', handleKeyDown);

// Mouse: Listen on canvas (only when cursor is over the game)
canvas.addEventListener('mousemove', handleMouseMove);
```

### The window Object

`window` is a **browser global** - always available in client-side JavaScript:

```typescript
window.addEventListener(...)   // Event listeners
window.location                // Current URL
window.localStorage            // Storage
window.innerWidth              // Browser width
```

No import needed - it's provided by the browser.

---

## Template Syntax

### Binding DOM Elements

```svelte
<script>
  let canvas: HTMLCanvasElement;
</script>

<!-- bind:this captures the DOM element -->
<canvas bind:this={canvas}></canvas>
```

After mount, `canvas` is the actual DOM element, usable with Three.js.

### Conditional Rendering

```svelte
{#if debug && gameState}
  <div class="debug-overlay">
    <p>Score: {gameState.score}</p>
  </div>
{/if}
```

Only renders if both `debug` is true AND `gameState` exists.

### Displaying Values

```svelte
<p>Score: {gameState.score}</p>
<p>Connected: {connected}</p>
```

Values in `{}` are evaluated and displayed. Updates automatically if they're `$state()`.

---

## Summary: SuperCluster.svelte Structure

```svelte
<script lang="ts">
  // 1. IMPORTS
  import { onMount, onDestroy } from 'svelte';
  import { GameRenderer } from './renderer';

  // 2. PROPS (from parent)
  interface Props { ... }
  let { debug = false }: Props = $props();

  // 3. REACTIVE STATE (for UI)
  let connected = $state(false);
  let gameState = $state<GameState | null>(null);

  // 4. NON-REACTIVE STATE (for logic)
  let canvas: HTMLCanvasElement;
  let renderer: GameRenderer | null = null;
  const inputState = { ... };

  // 5. LIFECYCLE
  onMount(() => {
    renderer = new GameRenderer(canvas);
    setupInputHandlers();
  });

  onDestroy(() => {
    cleanupInputHandlers();
    renderer?.dispose();
  });

  // 6. EVENT HANDLERS
  function handleKeyDown(event: KeyboardEvent) { ... }

  // 7. PUBLIC API (for parent)
  export function sendReady() { ... }
</script>

<!-- 8. TEMPLATE -->
<div class="container">
  <canvas bind:this={canvas}></canvas>
  {#if debug}
    <div class="overlay">...</div>
  {/if}
</div>

<!-- 9. STYLES -->
<style>
  .container { ... }
</style>
```
