# Ultracite Code Standards

This project uses **Ultracite** (Biome preset). Run `bun x ultracite fix`
before committing. Most issues are auto-fixable.

## Key Rules Enforced by Biome

- Prefer `unknown` over `any`; use const assertions (`as const`) for literals
- Use `?.` and `??` for safe property access
- Always `await` promises — don't discard return values
- Throw `Error` objects, not strings
- Prefer early returns over nested conditionals
- Use `class` and `for` in Svelte (not `className`/`htmlFor`)
- No `console.log`, `debugger`, or `alert` in production code
- No barrel files (index re-exports)
