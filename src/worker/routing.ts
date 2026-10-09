/**
 * Pure routing classification for `src/worker/index.ts`'s deny-by-default dispatch.
 *
 * Split out for the same reason `auth-helpers.ts` is split from `auth.ts`: this module imports
 * nothing that depends on the ambient Workers `Env` global (which `WorkerEnv`, and therefore
 * `index.ts`'s handler maps, extend), so it can be unit-tested directly under plain Node
 * (`npm run test:worker`) without a live Workers runtime.
 *
 * This is the single source of truth for which paths are public. `index.ts` imports the path
 * constants from here rather than re-declaring them, so the handler wiring and the
 * public/protected/not-found classification can never drift apart.
 */

/** Liveness probe — constant response, touches no dependency. */
export const HEALTH_PATH = '/api/health'

/** Database readiness probe — returns `select now()` only, no market-operator data. */
export const DB_HEALTH_PATH = '/api/db/health'

/** Returns the verified caller's own identity. Requires authentication. */
export const ME_PATH = '/api/me'

/**
 * Exhaustive allow-list of paths servable without authentication.
 *
 * Both entries are deployment readiness probes relied on by `docs/DEPLOYMENT.md` Step 5 and by
 * external uptime monitoring. Adding a path here is a security decision and must be justified in
 * review (see `index.ts`).
 */
const PUBLIC_PATHS: ReadonlySet<string> = new Set([HEALTH_PATH, DB_HEALTH_PATH])

/** Paths that require a verified Neon Auth session. */
const PROTECTED_PATHS: ReadonlySet<string> = new Set([ME_PATH])

export type RouteKind = 'public' | 'protected' | 'not-found'

/**
 * Classifies a request path as `'public'` (served with no authentication check), `'protected'`
 * (must pass `authenticate()` before its handler runs), or `'not-found'` (no handler exists at
 * all, for any known or unknown path).
 *
 * `'not-found'` deliberately does not distinguish "never existed" from "exists but is misspelled
 * in a route table": both are a 404, and that is the entire deny-by-default contract — anything
 * not explicitly public falls to a check, and anything not explicitly listed at all falls to 404,
 * never to being silently servable.
 */
export function classifyRoute(pathname: string): RouteKind {
  if (PUBLIC_PATHS.has(pathname)) {
    return 'public'
  }
  if (PROTECTED_PATHS.has(pathname)) {
    return 'protected'
  }
  return 'not-found'
}
