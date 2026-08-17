// Canonical tagged error: a typed value in the Effect error channel — never a `throw`.
// Copy into src/, rename `GreeterError`, and replace the fields.
//
// House style (see ../effect-conventions.md):
//   - `readonly _tag` literal identifies the error in a union.
//   - A descriptive `message` getter formats full operator-readable context.
//   - Optional `cause` carries the originating error so it is never lost.
//   - Fail-fast and loud: a missing/unreachable dependency is a config/ops error.

export interface GreeterErrorFields {
  readonly reason: string
  readonly input: string
  readonly cause?: unknown
}

export class GreeterError {
  readonly _tag = "GreeterError"
  readonly reason: string
  readonly input: string
  readonly cause?: unknown

  constructor(fields: GreeterErrorFields) {
    this.reason = fields.reason
    this.input = fields.input
    this.cause = fields.cause
  }

  get message(): string {
    return `Greeter failed [input=${JSON.stringify(this.input)}]: ${this.reason}`
  }

  toString(): string {
    return this.message
  }
}

// Terser alternative when you don't need a custom message:
//
//   import { Data } from "effect"
//   export class GreeterError extends Data.TaggedError("GreeterError")<{
//     readonly reason: string
//     readonly input: string
//     readonly cause?: unknown
//   }> {}
//
// Prefer the hand-written form above whenever the message benefits from formatting.
