# Effect-TS conventions

Drop this into a new project's `docs/` (or fold it into the project's `CLAUDE.md`). It follows
Effect's own idioms (Effect 4); where this doc and Effect's documentation disagree, Effect wins. The
companion code stubs live next to this file under `effect/` — copy them into `src/` as starting points.

The one rule everything else serves: **errors, dependencies, and async all flow through Effect's
typed channels — never through `throw`, ambient imports, or bare Promises.** Enforce it with
the Effect language service (`@effect/tsgo` on TypeScript 7+, `@effect/language-service` on TS ≤6)
at error severity, not a hand-rolled ESLint ban list — `floatingEffect`,
`tryCatchInEffectGen`, `asyncFunction`, and `newPromise` catch exactly this, and the
`*InEffect`-scoped globals (`globalConsoleInEffect`, `globalFetchInEffect`, etc.) flag stray
`console`/`fetch` only where they're actually inside Effect context, which is far better signal
than their unscoped twins (see the parent skill's "factory conventions").

## Services are `Context.Service` classes with Layers

A service is an interface of `readonly` methods that each return an `Effect`. Define it as a class
extending `Context.Service` (Effect 4; v3's `Context.Tag` and `Effect.Service` are gone), and provide an implementation as a `Layer`. This is the unit of dependency
injection — consumers depend on the *tag*, never on a concrete module.

```ts
import { Context, Effect, Layer } from "effect"
import { ModelError } from "./errors.js"

export class ModelClient extends Context.Service<
  ModelClient,
  {
    readonly complete: (
      handle: ModelHandle,
      messages: ChatMessage[],
    ) => Effect.Effect<CompletionResult, ModelError>
  }
>()("ModelClient") {}

// Implementation, wired as a Layer:
export const ModelClientLive = Layer.succeed(ModelClient, ModelClient.of({ complete }))
```

- `Context.Service<Self, Shape>()("ModelClient")` — the string is the service's runtime identity; keep it equal to the class name.
- The second type param is the **service shape**: an object of `readonly` methods returning `Effect.Effect<A, E>`.
- `Layer.succeed(Tag, Tag.of({ ...methods }))` for a static implementation. Use `Layer.effect` when the
  implementation must itself run an Effect to build (e.g. it depends on other services or resources).

→ stub: [`effect/service.ts`](effect/service.ts)

## Errors are tagged classes — descriptive and fail-fast

Every failure is a typed value in the Effect error channel, not a thrown exception. Define errors
with Effect's own constructors — never hand-roll a class with a `_tag` field:

- **`Schema.TaggedError` (default).** `_tag` is set automatically; the class extends `Error`
  (stack traces, readable `Cause` output); it is yieldable (`yield* new ModelError({...})` fails
  the Effect, no `Effect.fail` wrapper); and it is a Schema, so it serves directly as an
  `HttpApiEndpoint` error, round-trips over the wire, and appears in the OpenAPI spec.
  `httpApiStatus` in the annotations sets its HTTP status.
- **`Data.TaggedError`** for errors that stay inside one process and never cross a serialization
  boundary (no Schema to maintain).

```ts
import { Schema } from "effect"

export class ModelError extends Schema.TaggedError<ModelError>()(
  "ModelError",
  {
    model: Schema.String,
    baseUrl: Schema.String,
    reason: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 502 },
) {
  override get message(): string {
    return `Model call failed [model=${this.model} endpoint=${this.baseUrl}]: ${this.reason}`
  }
}
```

- One error class per distinct failure the caller can act on; recover by tag with
  `Effect.catchTag` / `catchTags`. Don't fold unrelated failures into one class with a `kind` field.
- Override `message` only when formatting the fields adds operator context; otherwise leave it.

**Fail-fast and loud.** A missing/unreachable dependency is a config/ops error — surface it
immediately with full context. Do not silently fall back or retry-forever; there is no automatic
failover. Carry `cause` so the original error is never lost.

→ stub: [`effect/tagged-error.ts`](effect/tagged-error.ts)

## Compose with `Effect.gen`, not raw Promises

Use `Effect.gen(function* () { ... })` with `yield*` for sequencing. Bring foreign Promise-based
APIs (`fetch`, SDK calls) into the typed error channel with `Effect.tryPromise({ try, catch })` —
the `catch` maps the thrown reason into one of your tagged errors.

```ts
const response = yield* Effect.tryPromise({
  try: () => fetch(url, { method: "POST", body: JSON.stringify(body) }),
  catch: (cause) => err(handle, `request failed (endpoint unreachable?): ${String(cause)}`, cause),
})

if (!response.ok) {
  const text = yield* Effect.promise(() => response.text().catch(() => ""))
  return yield* Effect.fail(err(handle, `HTTP ${response.status}: ${text.slice(0, 200)}`))
}
```

- `Effect.tryPromise` for Promises that can reject (map the rejection into a tagged error).
- `Effect.promise` for Promises you know won't reject.
- `Effect.fail(error)` to short-circuit with a typed failure; `return yield*` it.

## Model results as discriminated unions on `_tag`

Domain results, event categories, and lifecycle outcomes are discriminated unions keyed on `_tag`.
Consumers `switch` on `_tag` exhaustively. This is the same convention as the error tags, applied to
success values.

```ts
type EventCategory =
  | { _tag: "Heartbeat"; tick: number }
  | { _tag: "StateChange" }
  | { _tag: "LifecycleReset"; reason: string }
```

## Wire dependencies with `Layer.mergeAll` + `Effect.provide`

Bundle a set of service Layers into one, then inject the bundle at the boundary where the program
runs. Consumers ask for tags; the bundle satisfies them.

```ts
export const appBundle = Layer.mergeAll(
  ModelClientLive,
  DockerLive,
  LogWriterLive,
)

// At the run boundary:
yield* program.pipe(Effect.provide(appBundle))
```

→ stub: [`effect/layers.ts`](effect/layers.ts)

## Package-boundary discipline (in a monorepo)

When this lives in a monorepo (see the parent skill's "Monorepo structure"), the dependency arrows
are enforced, not just encouraged:

- **Core** (`@scope/core`) is domain-agnostic: tags, errors, engine code. It **never** imports from
  domain packages or apps.
- **Domain** packages depend on core and provide the Layers core's tags require. They **never** import
  each other.
- **Apps** depend on core + the domain packages and wire everything together (`Layer.mergeAll`,
  `Effect.provide`) at the entry point.

Inject implementations via tags at startup — the engine never reaches into a domain directly.
