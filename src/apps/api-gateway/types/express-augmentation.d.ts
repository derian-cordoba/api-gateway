/**
 * Augments the Express Request type with a `rawBody` field populated by the
 * body parser's `verify` hook. Used by webhook signature verification.
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Raw request body bytes, set by the `verify` callback in `express.json()`.
       * Available only on routes where the JSON body parser is active.
       */
      rawBody?: Buffer;
    }
  }
}

export {};
