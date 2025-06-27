import { IMiddlewareHandler } from 'mobx-state-tree'

// Atomic middleware for MST actions
// This provides proper middleware behavior that calls next() as required
export const atomic: IMiddlewareHandler = (call, next) => {
  // Just pass through to the next middleware without any special behavior
  // The actual atomicity (non-recording) is handled by UndoManager's skipRecording
  return next(call)
}
