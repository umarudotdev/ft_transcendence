# Use Tailwind CSS with Shadcn-Svelte and Native Svelte State

## Status

Accepted

## Context and Problem Statement

The ft_transcendence frontend requires a responsive, accessible UI that handles real-time data (game state, chat). We must satisfy evaluation modules for custom design systems and accessibility while maintaining performance for smooth game rendering.

How should we approach styling, component architecture, and state management to balance development velocity, accessibility compliance, and runtime performance?

## Decision Drivers

- Satisfy "Custom-made Design System" module requirement (Minor - 1pt)
- Ensure WCAG accessibility compliance for evaluation
- Minimize runtime overhead for smooth game rendering
- Reduce context switching between markup and styles
- Maintain type safety with the Elysia backend

## Considered Options

### Styling

- CSS Modules with custom components
- Styled Components / CSS-in-JS
- Tailwind CSS with Shadcn-Svelte

### State Management

- Redux / Zustand external state library
- TanStack Query for server state
- Native Svelte Stores

## Decision Outcome

Chosen option: "Tailwind CSS with Shadcn-Svelte" for styling and "Native Svelte Stores" for state management, because this combination provides accessible components out of the box, allows component customization that satisfies the design system module requirement, and leverages Svelte's built-in reactivity without external dependencies.

### Consequences

#### Positive

- Velocity: Pre-built accessible components (modals, dropdowns) without building from scratch
- Code Ownership: Shadcn pattern copies components into source, allowing direct modification
- Bundle Size: Svelte's compiler + Tailwind's tree-shaking produces minimal JavaScript
- Accessibility: Bits UI primitives provide WAI-ARIA compliance by default

#### Negative

- CSS Class Length: HTML templates can become cluttered with utility classes
- Learning Curve: Team members unfamiliar with Tailwind must learn utility class names

### Confirmation

The decision will be confirmed by:

- Lighthouse accessibility score of 90+ on key pages
- Component customizations passing evaluation as "custom design system"
- WebSocket updates reflecting immediately in UI via Svelte Stores

## Pros and Cons of the Options

### CSS Modules with Custom Components

- Good, because scoped styles prevent conflicts
- Good, because familiar CSS syntax
- Bad, because requires building all components from scratch including accessibility
- Bad, because context switching between .svelte and .css files
- Bad, because no design system baseline to customize

### Styled Components / CSS-in-JS

- Good, because styles co-located with components
- Good, because dynamic styling based on props
- Bad, because runtime overhead from style injection
- Bad, because larger bundle size
- Bad, because less mature Svelte ecosystem support

### Tailwind CSS with Shadcn-Svelte

- Good, because utility classes eliminate CSS file management
- Good, because Shadcn components are copied to source for full ownership
- Good, because Bits UI primitives ensure accessibility compliance
- Good, because responsive design via built-in breakpoint utilities

### Redux / Zustand External State Library

- Good, because proven patterns for complex state
- Good, because devtools for debugging
- Bad, because additional dependency and bundle size
- Bad, because boilerplate for simple state updates
- Bad, because overkill for Svelte's built-in reactivity

### Native Svelte Stores

- Good, because zero additional dependencies
- Good, because integrates naturally with Svelte's reactivity
- Good, because simple API (writable, readable, derived)
- Good, because WebSocket updates directly trigger UI re-renders
- Bad, because less prescribed patterns for complex state management

## More Information

### Component Architecture

Components are organized in `src/lib/components/ui/` following the Shadcn pattern:

- Base components copied from Shadcn-Svelte
- Customizations applied directly to source files
- Bits UI primitives handle keyboard navigation and focus management

### State Management Patterns

- **Global State**: Svelte Stores for app-wide state (active game session, WebSocket status)
- **Server State**: SvelteKit `load` functions and form actions
- **Real-Time State**: WebSocket messages write directly to stores, auto-updating UI

### Form Handling

Superforms library integrates with Zod schemas for:

- Client-side validation with immediate feedback
- Server-side validation with automatic error propagation
- Progressive enhancement support
