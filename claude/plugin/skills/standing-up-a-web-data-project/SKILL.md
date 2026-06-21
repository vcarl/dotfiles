---
name: standing-up-a-web-data-project
description: Use when scaffolding or standing up a NEW web-based data project — a SPA/dashboard backed by a store that ingests, stores, queries, and displays data (benchmark harness, analytics tool, admin dashboard, internal data app). Use at inception, before picking a stack or writing app code.
---

# Standing Up a Web Data Project

## Overview

**Build the factory, not just the thing.** The first job is the app; the real job is the system that builds the app efficiently. Two corollaries drive every choice below:

1. **Generate, never hand-write, anything a machine can derive** — types across the client/server seam, DB types, API clients. Hand-typing a backend shape into the frontend is banned.
2. **Decide the painful-to-bolt-on things on DAY 1** — sync/offline, streaming transport, the typed client↔server boundary. Retrofitting these is a rewrite, not a patch.

This is a reference for the blessed path. It's opinionated by default; deviate deliberately, not by drift.

## Day-1 decisions you must NOT defer

These are cheap now and brutal later. Make each one explicitly and write the choice into the repo's CLAUDE.md.

| Decision | Default | Why it can't wait |
|---|---|---|
| **Local-first / sync model** | Local store is source of truth via a sync engine (see below) | Optimistic writes, offline, and reactivity touch every read path. Bolting on later means rewriting every component's data access. |
| **Client↔server type boundary** | RR framework loaders/actions (`useLoaderData<typeof loader>`) — the seam is typed end-to-end, no codegen. For any standalone API: generate the client from a schema/OpenAPI spec. | A hand-typed boundary rots silently; a generated one breaks the build the instant the server changes. |
| **Streaming transport** | One blessed path. SSE for AI token streams; a single server-side event stream (Effect `Stream` + bounded queue) for live events. | "How do realtime updates flow?" answered five different ways = useEffect hell. Pick once. |
| **URL/query-param state** | First-class and typed — RR validated search params or `nuqs`. All filter/sort/selection state lives in the URL. | Deep links and shareable views are free if designed in, painful to add once state is scattered in `useState`. |

## Blessed stack

Distilled from the house style across the reference implementations plus current (2026) tooling.

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) + **Effect-TS** | Effect for errors / DI / service layers. `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` on. |
| App framework | **React Router v8, framework mode** | SSR + typed loaders/actions. Floors: Node 22.22+, React 19.2.7+, Vite 7+, ESM-only. Not Next for a SPA/dashboard. |
| Server-state seam | Route loaders/actions; **TanStack Query** for non-route server calls | The sync engine's local store is the *primary* read path; Query covers the rest. |
| Local store / sync | **Zero** (Rocicorp) by default | Best web DX + native multi-user realtime. Alternates: **ElectricSQL** (Postgres-centric), **PowerSync** (most mature, mobile). Avoid Triplit (community-maintained since 2025). |
| Memoization | **React Compiler v1.0** (enabled) | Stable since Oct 2025. Drop manual `useMemo`/`useCallback`. |
| Client state machines | **XState** for highly-interactive surfaces; `zustand` for simple bespoke client state | Model interactive UI (things entering/leaving view, playback, multi-step flows) as a state machine — not chained effects. |
| Loading / errors | **Suspense + ErrorBoundary** | Not `isPending`/`isError` sprinkled everywhere. |
| Styling | **Design tokens + a small component library** | An agent-first design system. Not ad-hoc Tailwind class soup — it can't hold consistency at scale. A `tokens.css` + components layer is the seam. |
| DB + types | SQLite or Postgres + **Kysely/Drizzle with codegen'd types** | Schema (migrations / Effect Schema) is the single source of truth; types are generated, never authored. |
| Package manager | **pnpm** | `packageManager` field pinned; `pnpm-workspace.yaml` for monorepos. |
| Build / lint / test | **Vite 7, Biome, Vitest** | Fail-fast config loading: decode all config at startup so bad input surfaces before work begins. |
| Deploy | **Cloudflare or Vercel** | Edge-managed. Other hosts have weird missing features. |

### Two patterns worth wiring early
- **Route-as-drawer**: a drawer/side-panel should be expressible as a route ("here's a route, render it as a drawer") with state handled by the router. Hack the router to fit this; don't reinvent panel state.
- **One read/write data module**: all reads and writes go through a single data layer with stable, client-generated entity IDs (ULID/UUID). Never raw-`fetch` in components. This is what makes the sync engine swappable.

## The factory conventions (copy these into every project)

These are what make the reference projects pleasant to work in:

- **A per-project `.claude/skills/` QA skill** that stands up the app cold and confirms it's "basically functional" — the surface real unit tests mock out (CLI/server boots, config resolves, data round-trips, the webapp renders). Author this skill alongside the app, not after.
- **An ergonomic launcher** (`./bench`-style executable) instead of long `npm run` paths.
- **Pre-commit that only touches staged files** — format staged files, re-stage only those, leave unstaged edits untouched.
- **Strict lint that enforces the discipline** — e.g. ban `try/catch/throw/console` outside the CLI/entry layer so the Effect error channel is actually used.
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

1. `git init`, then `git commit --allow-empty -m 'initial commit'` — a blank root commit gives you a consistent parent that survives later dramatic squashes. Then use **pnpm** (set the `packageManager` field and `pnpm-workspace.yaml` if a monorepo); set `engines` (Node 22.22+) and `.nvmrc`.
2. Strict `tsconfig`, Biome, Vitest, Husky pre-commit (staged-only).
3. Scaffold **React Router v8 framework mode**; enable **React Compiler**.
4. Stand up the **DB + migrations**; wire **type codegen**; fail-fast config loading.
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

## Source

Stack rationale follows the "architecting the frontend" notes (generate types; TanStack Query; sync from day 1; data loaders; typed URL state; single server-state source; XState for interactivity; React Compiler; design system over raw Tailwind; route-as-drawer; Suspense/ErrorBoundary; blessed websocket/SSE path; not Next for SPAs; Cloudflare/Vercel; build the factory).
