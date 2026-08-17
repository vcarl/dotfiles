// Canonical Effect service: a Context.Tag class + a Layer implementation.
// Copy into src/, rename `Greeter` → your service, and replace the method(s).
//
// House style (see ../effect-conventions.md):
//   - The service is an interface of `readonly` methods, each returning an Effect.
//   - Consumers depend on the TAG, never on this concrete module.
//   - `Layer.succeed` for a static impl; `Layer.effect` when building the impl
//     needs to run an Effect (e.g. it depends on other services/resources).

import { Context, Effect, Layer } from "effect"
import { GreeterError } from "./tagged-error.js"

export interface Greeting {
  readonly text: string
}

export class Greeter extends Context.Tag("Greeter")<
  Greeter,
  {
    readonly greet: (name: string) => Effect.Effect<Greeting, GreeterError>
  }
>() {}

// --- Implementation -------------------------------------------------------

const greet = (name: string): Effect.Effect<Greeting, GreeterError> =>
  Effect.gen(function* () {
    if (name.trim().length === 0) {
      return yield* Effect.fail(new GreeterError({ reason: "empty name", input: name }))
    }
    return { text: `Hello, ${name}!` }
  })

/** Static implementation. */
export const GreeterLive = Layer.succeed(Greeter, Greeter.of({ greet }))

// If the implementation depends on other services, build it inside an Effect:
//
// export const GreeterLive = Layer.effect(
//   Greeter,
//   Effect.gen(function* () {
//     const clock = yield* SomeClock          // depend on another tag
//     return Greeter.of({ greet: (name) => /* ...use clock... */ })
//   }),
// )
