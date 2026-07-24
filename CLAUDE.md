# CLAUDE.md

## 0. Purpose and Authority

This file defines the operating rules for every AI coding agent working in this repository.

The agent's job is not merely to produce code. The agent must improve the repository while preserving correctness, product intent, security, maintainability, and delivery speed.

Rules in this file apply unless a task-specific instruction explicitly overrides them. When instructions conflict, follow this priority:

1. Safety and security
2. Explicit user requirements
3. Existing repository conventions
4. This file
5. General engineering preferences

Never silently ignore a conflict. State the conflict and choose the safest reversible path.

---

## 1. Product Mission

Before implementation, identify:

- Who is the user?
- What problem is being solved?
- What observable outcome proves success?
- What is explicitly out of scope?
- What is the smallest implementation that can validate the requirement?

Do not optimize for technical elegance at the expense of product validation.

For MVP and MVR work:

- Prefer the smallest complete vertical slice.
- Preserve an upgrade path without building speculative infrastructure.
- Do not add features that were not requested.
- Do not confuse internal completeness with user value.
- Real usage and payment evidence outrank opinions, likes, or hypothetical demand.

Every substantial task should leave behind a reusable asset: code, test, schema, component, decision record, runbook, or validated learning.

---

## 2. Required Working Sequence

For every non-trivial task, use this sequence.

### 2.1 Inspect

Before changing code:

1. Read this file.
2. Inspect the repository structure.
3. Read relevant package manifests and configuration.
4. Find the current implementation and related tests.
5. Search for existing abstractions before creating new ones.
6. Check the current Git diff so unrelated user work is not overwritten.

Do not modify files before understanding the relevant execution path.

### 2.2 Plan

State a concise implementation plan containing:

- intended behavior
- files or modules likely to change
- important assumptions
- validation commands
- material risks

For small, obvious changes, keep the plan brief.

### 2.3 Implement

While implementing:

- Make the smallest coherent change.
- Preserve existing conventions unless they are defective.
- Avoid unrelated cleanup.
- Prefer reversible decisions.
- Keep the repository runnable throughout the change when practical.
- Never overwrite user-authored changes without explicit justification.

### 2.4 Verify

Verification is mandatory.

Run the most relevant available checks, such as:

- unit tests
- integration tests
- type checks
- lint
- formatting checks
- build
- database migration validation
- targeted manual smoke tests

Never claim a command passed unless it was actually run and completed successfully.

If verification cannot be run, state exactly why and provide the command that should be run.

### 2.5 Report

At completion, report:

- what changed
- why it changed
- files affected
- validation performed and results
- remaining risks or limitations
- any required manual steps

Do not produce inflated summaries.

---

## 3. Engineering Priorities

Use this default priority order:

1. Correctness
2. Security and data integrity
3. User-visible value
4. Maintainability
5. Observability and diagnosability
6. Performance
7. Implementation speed
8. Cleverness

For an explicit validation prototype, delivery speed may outrank long-term maintainability, but correctness and security still remain mandatory.

---

## 4. Architecture Rules

### 4.1 Preserve Boundaries

Keep these concerns separated where the project architecture supports it:

- domain and business rules
- application orchestration
- persistence
- external services and model providers
- transport and API
- UI and presentation

Business logic should not be tightly coupled to:

- UI frameworks
- database drivers
- vendor SDKs
- a specific AI model
- global process state

Use interfaces or adapters when vendor replacement is a credible requirement, not as automatic ceremony.

### 4.2 Avoid Parallel Architectures

Before adding a service, component, utility, schema, client, or state system, search for an existing equivalent.

Do not introduce:

- a second validation library
- a second HTTP client pattern
- a second state-management approach
- duplicate API clients
- duplicate domain models
- competing folder conventions

unless the task explicitly requires migration and includes a consolidation plan.

### 4.3 Dependency Direction

High-level policy should not depend directly on low-level details.

Prefer:

- dependency injection at clear boundaries
- explicit configuration
- pure domain functions
- small adapters around vendor SDKs

Avoid service locators, hidden globals, and import-time side effects.

### 4.4 Data Contracts

Treat schemas and API contracts as first-class artifacts.

When changing a contract:

- identify all producers and consumers
- maintain backward compatibility when required
- update validation and types
- add migration logic where necessary
- update examples and documentation
- test success and failure cases

Never rely on undocumented shape assumptions.

---

## 5. Code Design Rules

Write code that is:

- explicit
- cohesive
- predictable
- easy to delete or replace
- easy to test
- consistent with the repository

Prefer simple control flow over clever abstractions.

Avoid:

- premature generalization
- deep inheritance
- hidden mutation
- broad utility modules
- ambiguous boolean parameters
- functions with multiple unrelated responsibilities
- unnecessary metaprogramming
- implicit fallbacks that conceal errors

A function or module should have one clear reason to change.

### 5.1 Naming

Names must describe intent and domain meaning.

Prefer:

- `EvidenceCollector`
- `PainSignal`
- `createDemandProfile`
- `fetchOutlookEvents`

Avoid vague names such as:

- `Manager`
- `Helper`
- `Utils`
- `Processor`
- `Handler`
- `Data`

unless the domain makes the meaning unambiguous.

Avoid unexplained abbreviations.

### 5.2 Comments

Comments explain why, constraints, trade-offs, or non-obvious behavior.

Do not comment obvious syntax.

Delete or update stale comments in touched code.

### 5.3 File Organization

Do not create a new file unless it improves cohesion or isolates a meaningful boundary.

Avoid catch-all files such as:

- `utils`
- `helpers`
- `common`
- `misc`

Place code near its primary consumer until reuse is demonstrated.

---

## 6. Error Handling and Reliability

Never swallow errors silently.

Errors should:

- retain the original cause when possible
- include actionable context
- avoid exposing secrets
- distinguish retryable from non-retryable failures where relevant
- map cleanly to user-facing or API-facing behavior

Do not use broad exception handling merely to keep execution going.

For network and external-service calls:

- set explicit timeouts
- use bounded retries only for retryable failures
- use backoff and jitter when appropriate
- make repeated operations idempotent when practical
- avoid duplicate billing or duplicate writes
- surface provider request IDs when available

For background jobs and queues:

- define retry policy
- define failure visibility
- protect against duplicate processing
- record state transitions

---

## 7. Security and Privacy

Never commit, print, log, or expose:

- API keys
- access tokens
- refresh tokens
- passwords
- private keys
- session cookies
- connection strings containing credentials
- personal or confidential user data

Use environment variables or the repository's secret-management mechanism.

Before finishing, inspect the diff for secret leakage.

Validate and sanitize external input at trust boundaries.

Use least privilege for permissions and OAuth scopes.

Do not disable authentication, authorization, TLS verification, CSRF protection, or security checks merely to make a test pass.

For AI features:

- treat model output as untrusted input
- validate structured output
- prevent prompt content from directly authorizing privileged actions
- require explicit confirmation for destructive or externally visible actions
- do not place secrets in prompts
- minimize retained user content

---

## 8. Database and State Changes

Before modifying persisted data:

- understand the existing schema
- identify migration strategy
- consider rollback
- preserve existing records
- consider concurrent execution
- consider partial failure

Migrations must be deterministic and reviewable.

Never perform destructive schema changes without an explicit migration and recovery plan.

Use transactions when multiple writes must succeed or fail together.

Do not introduce an N+1 query pattern without justification.

---

## 9. API Rules

APIs should have:

- explicit request and response schemas
- consistent error formats
- input validation
- authentication and authorization where required
- stable naming
- documented pagination for collections
- explicit timeout and retry behavior for downstream calls

Do not return raw internal exceptions or vendor responses directly to clients.

Changing an existing public API requires compatibility analysis.

---

## 10. Frontend and Web Design Rules

When performing frontend or webpage work, first inspect:

- current design system
- component library
- design tokens
- routing
- page layout conventions
- responsive behavior
- available assets
- accessibility patterns

Do not create generic AI-looking interfaces.

Avoid by default:

- excessive gradients
- excessive glassmorphism
- arbitrary rounded cards
- decorative icons without meaning
- oversized hero sections
- low-information dashboards
- random colors
- inconsistent spacing
- motion without functional purpose

Before implementation, define or infer:

- information hierarchy
- spacing scale
- typography scale
- color roles
- component states
- responsive breakpoints

Reuse existing components and tokens.

Every meaningful interactive surface should consider:

- default
- hover
- focus
- active
- disabled
- loading
- empty
- error
- success states

Use semantic HTML and keyboard-accessible interaction.

Do not remove visible focus indicators.

For responsive layouts, test at least:

- narrow mobile
- tablet or compact desktop
- standard desktop

Check:

- overflow
- text wrapping
- touch target size
- fixed-position elements
- tables and code blocks
- long localized strings

For screenshot-based implementation:

1. Describe the page structure.
2. Identify reusable components.
3. Identify uncertain details.
4. Implement.
5. Run the page.
6. Compare the result against the reference.
7. Fix visible differences and responsive defects.

---

## 11. Testing Standards (project-specific)

Tests use **Vitest** (v4+), an ESM-native test runner. Test files live alongside source files with the `*.test.mjs` suffix.

```
src/providers/registry.mjs        →  src/providers/registry.test.mjs
src/launch.mjs                     →  src/launch.test.mjs
```

### Rules

- Run `npm test` before completing work.
- Use `vi` (Vitest's mock utility) for mocking; `vi.spyOn()` for spying, `vi.stubGlobal()` for globals, `vi.fn()` for mock functions.
- Avoid mocking the filesystem unless necessary — prefer temporary directories.
- Use `describe`/`it` blocks; use `expect` for assertions.

Tests should protect behavior, not implementation trivia.

For changed behavior, cover as relevant:

- happy path
- meaningful edge cases
- invalid input
- authorization boundaries
- external-service failure
- persistence behavior
- regression scenario

Do not create brittle snapshot tests as a substitute for behavioral assertions.

Do not delete or weaken tests solely to make the suite pass.

When fixing a bug, add a regression test when feasible.

Mocks should model the real contract accurately and remain narrowly scoped.

### Running tests

```bash
npm test              # run once (vitest run)
npm run ci            # lint + test
```

---

## 12. Performance

Do not optimize without evidence.

First identify:

- the bottleneck
- expected workload
- measurement method
- acceptable target

Prefer algorithmic and architectural improvements over micro-optimizations.

For user-facing web work, avoid unnecessary:

- network requests
- client bundle growth
- rerenders
- blocking work
- oversized images
- unbounded lists

Measure before and after material performance changes.

---

## 13. Dependencies

Before adding a dependency, determine:

- whether the standard library or current dependencies already solve the problem
- maintenance status
- license compatibility
- bundle or runtime impact
- security implications
- lockfile impact
- whether the abstraction is likely to remain useful

Do not add a dependency for trivial functionality.

Do not upgrade unrelated dependencies during a focused task.

---

## 14. Observability

Production-relevant flows should be diagnosable.

Use structured logging where the project supports it.

Include useful context such as:

- operation
- resource identifier
- provider
- duration
- outcome
- request or correlation ID

Never log secrets or full sensitive payloads.

Add metrics or traces only when they answer a concrete operational question.

---

## 15. Documentation

Update documentation when behavior, setup, architecture, API contracts, environment variables, or operational procedures change.

Documentation must match the implemented state.

Prefer concise examples that can be executed.

Record material architectural decisions when the repository has an ADR convention.

---

## 16. Git and Change Discipline

Before editing, inspect `git status` and relevant diffs.

Do not revert or overwrite unrelated uncommitted changes.

Keep changes focused on one logical purpose.

Avoid drive-by formatting or unrelated renaming.

Do not create commits unless explicitly asked.

Never force-push, rewrite history, delete branches, or run destructive Git commands without explicit permission.

Before completion, inspect the final diff.

---

## 17. Tool and Command Safety

Do not run destructive commands without explicit approval, including commands that can:

- delete files or data
- reset Git state
- drop databases
- overwrite production resources
- revoke credentials
- publish packages
- deploy externally
- send messages or emails
- incur material cost

Prefer dry-run and read-only inspection first.

Do not install global packages unless necessary and explicitly justified.

Use the repository's package manager and lockfile.

---

## 18. AI-Agent Behavior

Do not hallucinate:

- APIs
- package behavior
- file contents
- command results
- test outcomes
- environment configuration

When uncertain:

1. inspect the repository
2. read official documentation when available
3. run a minimal verification
4. clearly label remaining uncertainty

Do not repeatedly call the same tool with identical arguments when it is not making progress.

Do not fake implementation with placeholders unless placeholders are explicitly requested.

Do not hide incomplete work behind broad statements such as "production ready."

Keep the user informed during long tasks with concise progress updates and early findings.

---

## 19. Multi-Agent Collaboration

Assume other agents may work on the same repository.

To reduce conflicts:

- inspect current changes before editing
- keep task scope narrow
- avoid broad renames
- document non-obvious decisions
- do not modify shared configuration unnecessarily
- leave the repository in a coherent state

When reviewing another agent's work:

- evaluate behavior independently
- inspect the actual diff
- run verification
- do not assume prior claims are correct
- preserve useful work while correcting defects

---

## 20. Linting

ESLint v10 with flat config (`eslint.config.js`) enforces code quality. The config inherits `@eslint/js/recommended` and targets all `*.mjs` files under `src/`, `bin/`, `scripts/`.

### Rules

- Unused variables are errors (`no-unused-vars`), except when the name starts with `_`.
- `no-console` is off — this is a CLI tool, `console.log` is expected.
- Empty catch blocks are errors — use `catch { /* explain why ignore */ }` instead of bare `catch {}`.
- Global variables (`process`, `console`, `setTimeout`, `clearTimeout`, `AbortController`, `fetch`) are declared in the eslint config.

### Running

```bash
npm run lint              # check src/ bin/ scripts/
npm run ci                # lint + test (run before push)
```

Before committing, always run `npm run lint` and fix all errors. Do not suppress lint rules without justification.

---

## 21. CI/CD and Publishing

### GitHub Actions Workflows

**`.github/workflows/ci.yml`** — triggered on push/PR to `main`:
- Matrix test across Node.js 20, 22
- Runs `npm ci → lint → test`

**`.github/workflows/publish.yml`** — triggered on tag push matching `v*`:
- Runs lint + test
- Publishes to npm registry using `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

### Release Flow

```
1. Develop on branch → open PR to main
2. CI runs automatically (lint + test on 3 Node versions)
3. Merge to main
4. npm version patch    # or minor / major
5. git push --follow-tags
6. Publish workflow triggers automatically → npm publish
```

### Versioning

Use `npm version <patch|minor|major>` to bump the version. This automatically:
- Updates `version` in `package.json`
- Creates a git commit with the version message
- Creates an annotated git tag (e.g., `v1.2.0`)

Do not manually edit the version field in `package.json`.

### NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm test` | Run vitest once |
| `npm run lint` | ESLint check |
| `npm run ci` | lint + test (full pre-push check) |

The `prepublishOnly` hook runs `npm run ci` automatically before every `npm publish`, preventing broken releases.

### NPM Token

The repository requires a GitHub Secret named `NPM_TOKEN` containing an npm Automation Token (no 2FA, for CI usage). Generate one at `https://www.npmjs.com/settings/<user>/tokens`, type: Automation.

---

## 22. Definition of Done

A task is complete only when all applicable items are satisfied:

- requirements are implemented
- scope is controlled
- relevant architecture is preserved
- input and error cases are handled
- security implications are considered
- tests are added or updated
- relevant checks pass
- documentation is synchronized
- final diff contains no unrelated changes
- no secrets are exposed
- remaining limitations are disclosed

Final communication must distinguish:

- completed and verified
- completed but unverified
- not completed
- deferred by explicit scope

Act like the future maintainer will inherit the repository tomorrow.
