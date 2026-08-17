// Canonical dependency wiring: bundle service Layers, then inject at the run boundary.
// Copy into your app's entry package (e.g. apps/<app>/src/), not into core.
//
// House style (see ../effect-conventions.md):
//   - Bundle every service Layer with `Layer.mergeAll`.
//   - The program asks for TAGS; the bundle satisfies them.
//   - `Effect.provide(bundle)` injects implementations at the single run boundary.
//   - In a monorepo, this wiring lives in the APP — core never provides its own deps.

import { Effect, Layer } from "effect"
import { Greeter, GreeterLive } from "./service.js"

/** One bundle that satisfies all of the app's service tags. */
export const appBundle = Layer.mergeAll(
  GreeterLive,
  // DockerLive,
  // LogWriterLive,
)

// --- A program that depends on tags, run with the bundle provided -----------

const program = Effect.gen(function* () {
  const greeter = yield* Greeter // depend on the tag, not a concrete impl
  const greeting = yield* greeter.greet("world")
  return greeting.text
})

/** The entry point: provide the bundle once, here. */
export const main = program.pipe(Effect.provide(appBundle))

// Run it (Node entry):
//
//   import { Effect } from "effect"
//   Effect.runPromise(main).then(console.log)
