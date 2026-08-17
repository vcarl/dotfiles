---
name: standing-up-a-web-data-project
description: Use when scaffolding or standing up a NEW web-based data project — a SPA/dashboard backed by a store that ingests, stores, queries, and displays data (benchmark harness, analytics tool, admin dashboard, internal data app). Use at inception, before picking a stack or writing app code.
---

# Standing Up a Web Data Project

**Build the factory, not just the thing.** The first job is the app; the real job is the system that builds the app efficiently. Two corollaries drive every choice below:

1. **Generate, never hand-write, anything a machine can derive** — types across the client/server seam, DB types, API clients. Hand-typing a backend shape into the frontend is banned. The concrete pipeline is **The generation chain** below.
2. **Decide the painful-to-bolt-on things on DAY 1** — sync/offline, streaming transport, the typed client↔server boundary. Retrofitting these is a rewrite, not a patch.

This is a reference for the blessed path. It's opinionated by default; deviate deliberately, not by drift.

## Day-1 decisions you must NOT defer

These are cheap now and brutal later. Make each one explicitly and write the choice into the repo's CLAUDE.md.

| Decision | Default | Why it can't wait |
|---|---|---|
| **Local-first / sync model** | Local store is source of truth via a sync engine (see below) | Optimistic writes, offline, and reactivity touch every read path. Bolting on later means rewriting every component's data access. |
| **Client↔server type boundary** | **The generation chain** (below): server route/action definitions → generated OpenAPI → generated SDK. Framework loaders/actions are thin wrappers over the SDK and define no types of their own. | A hand-typed boundary rots silently; a generated one breaks the build the instant the server changes. |
| **Streaming transport** | One blessed path. SSE for AI token streams; a single server-side event stream (Effect `Stream` + bounded queue) for live events. | "How do realtime updates flow?" answered five different ways = useEffect hell. Pick once. |
| **URL/query-param state** | First-class and typed — RR validated search params or `nuqs`. All filter/sort/selection state lives in the URL. | Deep links and shareable views are free if designed in, painful to add once state is scattered in `useState`. |
| **Effect static enforcement** | `@effect/language-service` wired and patched into `tsc` at scaffold time (see checklist), not added later | Diagnostics are structural, not stylistic. Measured retrofit onto an existing ~216-file Effect codebase: 2083 violations across 196 files. Free at inception, a triage project after. |

## The generation chain

This is the standard the project is judged against: **one central schema, everything derived.** If you ever hand-roll a type that mirrors a DB or API shape, the factory has failed — stop and fix the chain, don't patch the type.

The chain is **DB-first**. Exactly three artifacts are hand-authored; every other type is generated from the layer above it:

| # | Artifact | Authored / generated |
|---|---|---|
| 1 | **Migrations** | Hand-authored — the single source of data-model truth |
| 2 | DB schema types | Generated — `kysely-codegen` against the migrated DB |
| 3 | **Domain schemas** (Effect Schema) | Hand-authored, wrapping/refining the generated DB types — never restating them |
| 4 | **Route/action definitions** | Hand-authored against the domain schemas (Effect `HttpApi` or equivalent) |
| 5 | OpenAPI spec | Generated from the route definitions |
| 6 | Client SDK | Generated from the spec |

Each generation step is a task-graph target gated on its upstream (`^build`), never a manual command. The proof the chain works: change a migration and a type error surfaces in the client **in the same PR** — no step in between requires a human to remember anything.

### Hints: affordances ride the spec

Server-authored hints tell a generated client what a value *is* and what it can *do next*. Reference implementation: `~/workspace/gameserver` (Go producer; `internal/openapi/schema_registry.go`) with TypeScript consumer `~/workspace/spacemolt-lib`. The rules that port:

- **Hints are OpenAPI vendor extensions (`x-*`), not a runtime HATEOAS envelope.** Two families: schema-level (`x-display`: id/label/primary columns, `next_actions` templates with `{field}` placeholders resolved per row) and operation-level (`x-is-mutation`-style cost/effect flags).
- **The knowledge lives on the type, never in a name-keyed side table.** The reference started with a central name→hint map; its field-name strings silently orphaned on rename and it was replaced with per-type derivation. Our carrier is Effect Schema annotations on the domain schemas (layer 3) — a rename moves or breaks the hint, never orphans it.
- **Three guard tests, day one:** (1) derivation-equality — re-derive each hint and byte-diff against what the served spec carries; (2) every field name a hint references is a real property of its component; (3) every `next_action` resolves to a real endpoint + params in the same document (the test the reference never wrote).
- **Budget a custom pass in SDK generation.** Off-the-shelf OpenAPI generators silently drop unknown `x-*` keys — only `discriminator` survives the standard toolchain. The SDK build re-parses the raw spec to recover hints, cross-referencing the generator's output only for type names.
- **Define `{field}` resolution semantics — including the absent-field case — before shipping.** The reference left it as a doc comment repeated across 39 implementations with no defined answer.
- **Emission ≠ adoption.** A hint earns its keep by acquiring consumers: the reference's mutation flag drives SDK return types, runtime dispatch, and a semver gate (a query↔mutation flip is a major bump); its positional-index hint reached the SDK's catalog and is read by nothing. Ship each hint with at least one consumer or a written deferral.

## Blessed stack

Distilled from the house style across the reference implementations plus current (2026) tooling.

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) + **Effect-TS** | Effect for errors / DI / service layers. `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` on. Wire **`@effect/language-service`** day-1 (see `Build / lint / test` row) — retrofitting it onto a mature codebase is a multi-thousand-violation triage project. House style + copy-in stubs: **`templates/effect-conventions.md`** and **`templates/effect/`** (distilled from `roci`). |
| App framework | **React Router v8, framework mode** (default, not a commitment) | The framework is downstream of the generation chain: any framework qualifies iff its server seam consumes the generated SDK rather than defining its own types. Floors: Node 22.22+, React 19.2.7+, Vite 7+, ESM-only. Not Next for a SPA/dashboard. |
| Server-state seam | Route loaders/actions; **TanStack Query** for non-route server calls | The sync engine's local store is the *primary* read path; Query covers the rest. |
| Local store / sync | **Zero** (Rocicorp) by default | Best web DX + native multi-user realtime. Alternates: **ElectricSQL** (Postgres-centric), **PowerSync** (most mature, mobile). Avoid Triplit (community-maintained since 2025). |
| Memoization | **React Compiler v1.0** (enabled) | Stable since Oct 2025. Drop manual `useMemo`/`useCallback`. |
| Client state machines | **XState** for highly-interactive surfaces; `zustand` for simple bespoke client state | Model interactive UI (things entering/leaving view, playback, multi-step flows) as a state machine — not chained effects. |
| Loading / errors | **Suspense + ErrorBoundary** | Not `isPending`/`isError` sprinkled everywhere. |
| Styling | **Design tokens + a small component library** | An agent-first design system. Not ad-hoc Tailwind class soup — it can't hold consistency at scale. A `tokens.css` + components layer is the seam. |
| DB + types | SQLite or Postgres + **Kysely, codegen'd types** | Migrations are the root of **The generation chain** (above); DB types are generated (`kysely-codegen`), never authored. Drizzle is acceptable only if its codegen covers the chain equally. |
| Package manager | **pnpm** | `packageManager` field pinned; `pnpm-workspace.yaml` for monorepos. |
| Build / lint / test | **Vite 7, Biome, Vitest** + **`@effect/language-service`** | Biome stays blessed for formatting/syntax. The language-service is a TS-language-service plugin, not a linter — it type-checks Effect usage (floating effects, sync-in-`gen`, unsafe assertions, etc.), so it's orthogonal to Biome, not a replacement. It's editor-only until its `patch` command is run to make `tsc` itself emit the diagnostics (see scaffold checklist). `@effect/eslint-plugin` is effectively dead — don't reach for it. The moment a custom *type-aware* rule is needed, ESLint + typescript-eslint comes back too: neither Biome nor oxlint can host type-aware rules. Fail-fast config loading: decode all config at startup so bad input surfaces before work begins. |
| Deploy | **Cloudflare or Vercel** | Edge-managed. Other hosts have weird missing features. |

### Two patterns worth wiring early
- **Route-as-drawer**: a drawer/side-panel should be expressible as a route ("here's a route, render it as a drawer") with state handled by the router. Hack the router to fit this; don't reinvent panel state.
- **One read/write data module**: all reads and writes go through a single data layer with stable, client-generated entity IDs (ULID/UUID). Never raw-`fetch` in components. This is what makes the sync engine swappable.

## Monorepo structure

Once a project grows past one deployable — a backend (monolith and/or microservices), a web app, a native app, a UI toolkit, a generated API SDK — put them in one pnpm workspace. A monorepo is **not** a monolith: services stay independently deployable; what they share is *source-level libraries*, not a runtime.

### The three-bucket layout

The rule that keeps it sane: all dependency arrows point *into* `packages/`.

| Bucket | Contains | Rule |
|---|---|---|
| **`apps/*`** | Things a human uses: web, native (`mobile`), admin. | Deployed, never imported by anything. |
| **`services/*`** | Things a machine calls: the monolith + each microservice + gateway. | Deployed. Talk to each other over the network, **never** by importing each other's source. |
| **`packages/*`** | Never-deployed shared libs: `ui`, `api-sdk`, `api-contract`, `core` (domain types/Effect Schema), `config` (eslint/tsconfig presets), `observability`. | Imported only. `"private": true`, no version numbers. |

The monolith is just a bigger `services/*` peer. Splitting a microservice out later = `mkdir services/foo`, move code — no repo migration.

### The three mechanics that make it work

1. **`pnpm-workspace.yaml`** declares the package globs (`apps/*`, `services/*`, `packages/*`).
2. **The `workspace:` protocol** is the key primitive. Internal deps are pinned as `"@acme/ui": "workspace:*"`, which pnpm resolves to a **symlink** — editing a shared package is instantly live in every consumer, no rebuild-publish loop. At publish time pnpm rewrites `workspace:*` to the real version, so published artifacts are normal. Most internal packages stay `private` and never publish; the symlink *is* the distribution.
3. **Catalogs** (pnpm 9.5+) pin shared dep versions once (`react: catalog:`) so React/TS/etc. stay in lockstep across every package. Combined with the content-addressable store, 50 packages sharing React means one copy on disk, and strict `node_modules` catches "imports something it never declared" bugs.

### Orchestration: Nx (blessed)

pnpm answers *how packages install and link*; **Nx** answers *how tasks run fast and in the right order* — the task graph, `nx affected` (build/test only what a diff touches), code generators, and **module-boundary enforcement** (the thing that stops `apps/` importing `apps/`, or a service importing another service's source). This matches the `roci` reference (Nx + Effect-TS DI, domain-as-plugin). **Turborepo** is the lighter alternative for a small JS/TS-only repo that just needs caching + task ordering and no generators/boundaries — start there only if Nx is overkill, and graduate to Nx as the platform needs appear.

### The generated-SDK pattern (the payoff)

This is **The generation chain** mapped onto workspace packages — and the single biggest reason a project with a generated API client wants a monorepo:

- **`packages/api-contract`** holds chain layers 4–5: the route/action definitions and the OpenAPI spec generated from them.
- **`packages/api-sdk`** is layer 6: a codegen build step that consumes the spec and emits the typed client, including the custom pass that recovers `x-*` hints.
- **`apps/web`** depends on `@acme/api-sdk` via `workspace:*`.

Wire the order into the task graph (Nx `dependsOn` / `^build`), never run generators by hand. When an endpoint changes, `contract → sdk → web` rebuilds and the web app gets a **type error in the same PR** if it's using the endpoint wrong. **Commit** the generated SDK (`api-sdk/src/generated.ts`) — reviewable diffs, simpler CI.

**Why this must be one workspace:** the strongest argument is a failure observed in the wild. The `gameserver` reference runs this exact chain across two repos, syncing the spec to its SDK on a 30-minute cron. The sync job's typecheck gate began failing — correctly, loudly — and nobody was watching: the loop stayed wedged for weeks while seven server releases shipped past it, silently voiding every hint added upstream. A gate nobody watches doesn't hold the line; it wedges. In one workspace the loop is structural — the schema change that breaks the SDK fails the PR that made it, not a background job. If a polyrepo consumer is ever unavoidable, alert on the sync job *failing*, not just run it on a schedule.

### Microservices + monolith specifics

- They coexist as peers under `services/*`, each with its own `Dockerfile` and deps. Putting them in one repo does **not** couple them at runtime.
- They communicate over the network (HTTP/gRPC/queues). If one needs another, it uses `@acme/api-sdk` — same as the web app. Never `import` across a service boundary; that re-introduces the coupling microservices exist to avoid.
- Shared concerns (`@acme/core` types, `@acme/observability` logging/tracing) live in `packages/*` — a fix ships to every service in one PR.
- Deploy one service in isolation with `pnpm deploy --filter=payments` (produces a self-contained subtree with workspace deps flattened in — no monorepo baggage in the image). CI runs `nx affected` so a one-line change to `payments` doesn't rebuild the web app.

### Versioning

Internal `packages/*` and `services/*` stay `"private": true` with no version numbers — they're consumed by symlink, so versions are meaningless. Reach for **Changesets** *only* for packages published outside the repo. For a closed product, skip per-package versioning and deploy from `main`.

### Monorepo gotchas

| Gotcha | Do instead |
|---|---|
| React Native / Metro choking on pnpm's symlinked `node_modules` | Set `node-linker=hoisted` in the mobile app's `.npmrc` (or `nodeLinker` tweak). Verify early if native is in scope — this is where pnpm strictness bites. |
| `apps/` importing `apps/`, or services importing each other's source | Enforce with Nx module-boundary rules (built in). Don't rely on discipline. |
| Generated SDK drifting from the contract | Codegen is a task-graph step gated on `^build`, never a manual command. |

## The factory conventions (copy these into every project)

These are what make the reference projects pleasant to work in:

- **A per-project `.claude/skills/` QA skill** that stands up the app cold and confirms it's "basically functional" — the surface real unit tests mock out (CLI/server boots, config resolves, data round-trips, the webapp renders). Author this skill alongside the app, not after.
- **An ergonomic launcher** (`./bench`-style executable) instead of long `npm run` paths.
- **Pre-commit that only touches staged files** — format staged files, re-stage only those, leave unstaged edits untouched.
- **`@effect/language-service` at error severity enforces the discipline off-the-shelf** — `floatingEffect`, `tryCatchInEffectGen`, `asyncFunction`, `newPromise`, and the `*InEffect`-scoped global bans (`globalConsoleInEffect`, `globalFetchInEffect`, etc. — prefer these over their unscoped twins, far better signal) so the Effect error channel is actually used. Don't hand-roll this as an ESLint ban list.
- **Immutable, resumable data writes** — header-open → append → finalize-once, so an interrupted run is detectable and never corrupts.

## Anti-patterns to design AWAY (learned the hard way)

| Anti-pattern | Do instead |
|---|---|
| One process running web server + workers + gateway/jobs together | Separate concerns; a crash in one subsystem must not take down the others. |
| Relative DB path (`./app.sqlite3`) | Absolute path via env var. Relative paths silently create empty DBs in worktrees. |
| `npm run dev` auto-seeds/reseeds and clobbers data | Split "init empty DB" (CI/first-run) from "start server". Reseeding is opt-in. |
| Partial HMR coverage (some dirs hot-reload, some don't) | Make the boundary explicit and loud, or you'll test stale code and chase ghosts. |
| Release branch that diverges from `main` with no back-merge | Automate the back-merge, or block the merge until the fix is on both. |

## Scaffold checklist

1. `git init`, then `git commit --allow-empty -m 'initial commit'` — a blank root commit gives you a consistent parent that survives later dramatic squashes. Then use **pnpm** (set the `packageManager` field; if more than one deployable, lay down the workspace per **Monorepo structure** above — `pnpm-workspace.yaml`, `apps/`+`services/`+`packages/`, Nx); set `engines` (Node 22.22+) and `.nvmrc`.
2. Strict `tsconfig` — add `"plugins": [{"name": "@effect/language-service"}]` — Biome, Vitest, Husky pre-commit (staged-only). The tsconfig entry alone is editor-only squiggles; run the language-service's `patch` command and wire it into a `prepare`/`postinstall` script so it re-patches `node_modules/typescript` after every `npm ci` — skip this and CI silently enforces nothing. Copy `templates/effect-conventions.md` into the project's `docs/` (or fold into `CLAUDE.md`); seed `src/` from the `templates/effect/` stubs (service tag, tagged error, layer wiring).
3. Scaffold **React Router v8 framework mode**; enable **React Compiler**.
4. Stand up the **DB + migrations**; wire **the full generation chain** end-to-end (DB types → domain schemas → routes → OpenAPI → SDK) as task-graph targets, and prove it — change a migration, watch the type error surface in the client. Fail-fast config loading.
5. Choose and integrate the **sync engine** (Zero default); build the single data module with client-generated IDs.
6. Decide the **streaming transport**; wire the one blessed path.
7. Lay down **design tokens + component lib**; typed URL search-param state.
8. Add the **`.claude/skills/` QA skill** and an **ergonomic launcher**.
9. Wire **Cloudflare/Vercel** deploy.
10. Write the day-1 decisions and HMR/process boundaries into the project's `CLAUDE.md`.

## Reference implementations (on this machine)

- `~/workspace/testbench/llms` — CLI + immutable archive + portable static webapp; TanStack Router with URL-state-as-first-class; fail-fast config; `./bench` launcher; content-addressed storage. The ergonomics to emulate.
- `~/workspace/roci` — Nx + Effect-TS DI, domain-as-plugin architecture, template-domain example, devcontainer. The clean-architecture reference.
- `~/workspace/mod-bot` — RR framework loaders, Kysely DB-type codegen, Effect `Stream` event bus, strong `.claude/skills/` QA convention. Also the source of the anti-patterns above (single-process, relative DB path, reseed clobbering, partial HMR).
- `~/workspace/gameserver` + `~/workspace/spacemolt-lib` — Go producer and TypeScript consumer of the hints system: `x-display` derived from struct tags + a `DisplayActions()` method, guarded by derivation-equality tests; the SDK side proves the custom extension-recovery pass and the semver gate on `x-is-mutation`. The source for the hints subsection above — including its cautionary halves (the wedged cross-repo sync loop, hints emitted but never consumed).

## Source

Stack rationale follows the "architecting the frontend" notes (generate types; TanStack Query; sync from day 1; data loaders; typed URL state; single server-state source; XState for interactivity; React Compiler; design system over raw Tailwind; route-as-drawer; Suspense/ErrorBoundary; blessed websocket/SSE path; not Next for SPAs; Cloudflare/Vercel; build the factory).
