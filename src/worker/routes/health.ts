import { getSql } from '../db.ts'
import type { WorkerEnv } from '../types.ts'

/** Liveness probe. Proves the Worker is deployed and `/api/*` routing works. Touches no dependency. */
export function handleHealth(): Response {
  return Response.json({ ok: true, service: 'market-management' })
}

/**
 * Database readiness probe. Proves a live round trip to Neon.
 *
 * `select now()` is used because it is cheap, side-effect-free and requires no schema,
 * which matters while the database has no tables.
 */
export async function handleDbHealth(env: WorkerEnv): Promise<Response> {
  try {
    const sql = getSql(env.DATABASE_URL)
    const rows = await sql`select now() as now`
    const now = (rows[0] as { now: unknown }).now
    return Response.json({ ok: true, now })
  } catch (error) {
    // Server-side only. Captured by Cloudflare observability, which is enabled in
    // wrangler.jsonc. The driver's message can contain fragments of DATABASE_URL, so
    // it must never reach the response body.
    console.error('db health check failed', error)
    return Response.json({ ok: false, error: 'database unavailable' }, { status: 503 })
  }
}
