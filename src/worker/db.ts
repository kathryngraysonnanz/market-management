import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

/**
 * The single point at which this application talks to PostgreSQL.
 *
 * Uses the Neon serverless driver over HTTP: each query is one stateless HTTPS
 * request, which suits the Workers execution model and needs no connection pool
 * management in application code.
 *
 * Known limits of the HTTP transport: one statement per round trip, and no
 * interactive transactions. Multiple statements can be sent as a single
 * non-interactive transaction with `sql.transaction([...])`.
 *
 * Schema changes are therefore never made here — see scripts/migrate.ts and db/README.md.
 *
 * This module is intentionally the only place that knows which driver is in use. If
 * the project later moves to Cloudflare Hyperdrive with node-postgres, only this file
 * changes; route handlers are unaffected.
 *
 * Pinned to the default `neon()` instantiation (`arrayMode: false`, `fullResults:
 * false`): `ReturnType<typeof neon>` alone leaves both type parameters unresolved,
 * which widens query results to a union including `FullQueryResults` and makes
 * `rows[0]` fail to type-check.
 */
export type Sql = NeonQueryFunction<false, false>

/**
 * Build a query client for one request.
 *
 * Call this inside a request handler. Do not cache the result at module scope: the
 * connection string is per-environment and the client is cheap to construct.
 *
 * Throws if `connectionString` is empty or malformed. Callers must catch and must not
 * surface the thrown error to a client, because driver errors can echo fragments of
 * the connection string.
 */
export function getSql(connectionString: string): Sql {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }
  return neon(connectionString)
}
