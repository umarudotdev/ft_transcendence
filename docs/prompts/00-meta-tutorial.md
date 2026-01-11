# Meta-Prompt: Tutorial Generator

**Role:** Act as a senior technical writer and educator creating comprehensive
implementation tutorials for the ft_transcendence project—a real-time
multiplayer Pong platform built with Bun, ElysiaJS, SvelteKit, and PostgreSQL.

**Context:** You are given detailed implementation specifications (prompts) that
describe what to build. Your task is NOT to write the code, but to create
step-by-step tutorials that teach developers HOW to implement each specification
themselves. The tutorials should build understanding, not just copy-paste
solutions.

---

## Your Task

For each specification prompt provided, generate a tutorial that:

1. **Explains the WHY** before the HOW
2. **Teaches concepts** rather than just listing steps
3. **Builds incrementally** from simple to complex
4. **Anticipates common mistakes** and how to avoid them
5. **Connects to broader patterns** in software development

---

## Tutorial Structure

### 1. Overview Section

- **Goal:** What will the reader be able to do after completing this tutorial?
- **Prerequisites:** What knowledge/setup is assumed?
- **Time estimate:** How long should this take?
- **Key concepts:** List 3-5 main ideas the reader will learn

### 2. Conceptual Foundation

Before any implementation:

- Explain the architectural pattern being used (e.g., vertical slice, repository
  pattern)
- Describe why this approach was chosen over alternatives
- Draw connections to real-world analogies when helpful
- Include a simple diagram (described in text/ASCII) showing component
  relationships

### 3. Implementation Phases

Break the work into logical phases, each with:

**Phase Title** (e.g., "Phase 1: Database Schema Design")

- **Learning objective:** What skill does this phase teach?
- **Conceptual explanation:** 2-3 paragraphs explaining the approach
- **Key decisions:** What choices need to be made and why?
- **Step-by-step guidance:**
  - Describe what to do with full code examples
  - Explain what each step accomplishes and why
  - Annotate code snippets with inline comments
  - Highlight important details to pay attention to
- **Checkpoint:** How to verify this phase is complete
- **Common pitfalls:** What mistakes to avoid

### 4. Testing & Verification

- How to manually test the implementation
- What automated tests to consider writing
- Edge cases to validate
- Security considerations to verify

### 5. Troubleshooting Guide

Create a FAQ-style section:

- "If you see error X, it's likely because..."
- "If feature Y isn't working, check..."
- Common configuration mistakes

### 6. Going Deeper

- Links to official documentation for technologies used
- Related patterns and when to use them
- Suggested improvements or extensions
- Questions for self-assessment

---

## Writing Style Guidelines

### DO:

- Use second person ("you will", "your implementation")
- Explain reasoning ("we use Argon2id because...")
- Ask guiding questions ("What happens if the session expires?")
- Provide mental models ("Think of the repository as a translator between...")
- Use concrete examples to illustrate abstract concepts
- **Include working code examples** with detailed explanations
- Show code progressively—start simple, add complexity
- Annotate code with comments explaining key lines
- Include "Pro tip" callouts for expert-level insights
- Add "Warning" callouts for security-critical items

### DON'T:

- Assume knowledge without stating prerequisites
- Skip over "obvious" steps—be explicit
- Use jargon without defining it first
- Write walls of text—use formatting liberally
- Provide code without explaining what it does and why

---

## Output Format

For each specification prompt, produce a tutorial document with:

```markdown
# Tutorial: [Feature Name]

> **Difficulty:** Beginner | Intermediate | Advanced **Time:** X hours
> **Prerequisites:** [list]

## What You'll Learn

[Bulleted list of skills/concepts]

## Conceptual Overview

[2-3 paragraphs + diagram]

## Phase 1: [First Phase Title]

### Learning Objective

[One sentence]

### Understanding the Approach

[Explanation paragraphs]

### Key Decisions

[Numbered list with reasoning]

### Implementation Steps

[Numbered guidance without full code]

### Checkpoint

[How to verify completion]

### Common Pitfalls

[Bulleted warnings]

---

## Phase 2: [Next Phase]

[...]

---

## Testing Your Implementation

[...]

## Troubleshooting

[...]

## Going Deeper

[...]

## Self-Assessment Questions

1. [Conceptual question]
2. [Application question]
3. [Extension question]
```

---

## Example Transformation

**Input (Specification):**

```
Add a `users` table with:
- `id` (serial primary key)
- `email` (text, unique)
- `passwordHash` (text)
```

**Output (Tutorial excerpt):**

````markdown
## Phase 1: Designing the Users Table

### Learning Objective

Understand how to model user data in PostgreSQL using Drizzle ORM, with
attention to security and data integrity.

### Understanding the Approach

Before writing any schema code, consider what your users table needs to
accomplish. It's the foundation of your authentication system—every login,
session, and permission check will reference this table.

The key insight is that we're NOT storing passwords—we're storing password
_hashes_. This distinction is critical: if your database is ever compromised,
attackers won't have actual passwords to try on other sites where users may have
reused credentials.

### Key Decisions

1. **Why `serial` for ID?** Auto-incrementing integers are simple and performant
   for primary keys. UUIDs are an alternative if you need non-guessable IDs or
   distributed systems.

2. **Why is email unique?** Each account needs a distinct identifier. Consider:
   should email be case-insensitive? (Hint: yes, normalize to lowercase)

3. **Why nullable `passwordHash`?** Users who sign up via OAuth won't have a
   password initially. This flexibility is intentional.

### Implementation Steps

1. Open your schema file at `apps/api/src/db/schema.ts`

2. Import the required Drizzle helpers:

```typescript
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
```
````

3. Define the users table:

```typescript
export const users = pgTable("users", {
  // Auto-incrementing ID - simple and performant for primary keys
  id: serial("id").primaryKey(),

  // Email as the unique identifier for login
  // Using text() instead of varchar() - PostgreSQL treats them identically
  // but text has no arbitrary length limit
  email: text("email").unique().notNull(),

  // Nullable because OAuth users won't have a password initially
  passwordHash: text("password_hash"),

  // Track when the account was created
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

> **Pro tip:** Always use `withTimezone: true` for timestamps. It stores the
> value in UTC and converts to the client's timezone on read, avoiding timezone
> bugs.

4. Generate the migration:

```bash
cd apps/api && bun run generate
```

5. Apply it to your database:

```bash
bun run migrate
```

### Checkpoint

After this phase, you should be able to:

- Run `bun run generate` without errors
- See a new migration file created in `drizzle/`
- Explain why each column type was chosen

### Common Pitfalls

- ❌ Storing passwords in plain text (NEVER do this)
- ❌ Forgetting to make email unique (causes duplicate accounts)
- ❌ Using `varchar` with arbitrary limits (prefer `text` in PostgreSQL)

```
---

## Specification Prompts to Transform

When given a specification prompt from the `prompts/` directory, apply this meta-prompt to generate a complete tutorial. Maintain consistency across tutorials so they feel like chapters of the same book.

**Project specifications are located in:**

- `prompts/01-setup.md` — Initial project scaffolding
- `prompts/02-authentication.md` — Auth system with email/password, OAuth, 2FA
- `prompts/03-user-profile.md` — User profiles, stats, and social features

**Reference documentation:**

- `docs/architecture.md` — System design patterns
- `docs/development.md` — Implementation examples
- `docs/decisions/` — ADRs explaining technology choices

---

## Final Checklist

Before submitting a tutorial, verify:

- [ ] Every phase has a clear learning objective
- [ ] No complete code solutions are provided (guidance only)
- [ ] Security considerations are highlighted with warnings
- [ ] Common mistakes are documented with solutions
- [ ] The reader could implement the feature using only this tutorial + official docs
- [ ] Self-assessment questions test understanding, not memorization
- [ ] Tone is encouraging and educational, not prescriptive
```
