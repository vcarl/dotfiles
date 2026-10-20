// Canonical tagged error (Effect 4): a typed value in the Effect error channel — never a `throw`.
// Copy into src/, rename `GreeterError`, and replace the fields.
//
// See ../effect-conventions.md:
//   - `Schema.TaggedError` is the default: `_tag` is populated automatically, the class
//     extends `Error` (stack traces, readable `Cause` output), it is yieldable
//     (`yield* new GreeterError(...)` fails the Effect), and it is a Schema — so it can be
//     an `HttpApiEndpoint` error directly and round-trips over the wire.
//   - `httpApiStatus` sets the HTTP status when the error is returned from an endpoint.
//   - Override `message` only when formatting the fields adds operator context.
//   - `cause` carries the originating error so it is never lost.

import { Schema } from "effect"

export class GreeterError extends Schema.TaggedError<GreeterError>()(
  "GreeterError",
  {
    reason: Schema.String,
    input: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 422 },
) {
  override get message(): string {
    return `Greeter failed [input=${JSON.stringify(this.input)}]: ${this.reason}`
  }
}

// Internal-only error that never crosses a serialization boundary (no Schema needed):
//
//   import { Data } from "effect"
//   export class CacheMiss extends Data.TaggedError("CacheMiss")<{
//     readonly key: string
//   }> {}
