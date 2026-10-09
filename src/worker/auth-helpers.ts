/**
 * Pure, environment-independent helpers for `src/worker/auth.ts`.
 *
 * Split out so they can be unit-tested from `scripts/worker-auth.test.ts` under
 * `tsconfig.node.json` without pulling in the Workers-only global `Env` type that
 * `WorkerEnv` (and therefore the rest of `auth.ts`) depends on. `tsconfig.worker.json`'s
 * ambient Workers types and Node's own global types are mutually incompatible (e.g. `URL`,
 * `fetch`), so the two must never be loaded into the same TypeScript program.
 */
import type { JWTPayload } from 'jose'
import type { AuthenticatedUser } from './auth-types.ts'

/** Strips any trailing slashes so URL joining is predictable regardless of how the value was set. */
export function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * Expected `iss` claim: the ORIGIN of the base URL, not the base URL itself.
 *
 * Neon's base URL carries a path (`https://ep-xx.../neondb/auth`) while the issuer does not
 * (`https://ep-xx...`). Comparing against the full base URL would reject every valid token.
 */
export function expectedIssuer(baseUrl: string): string {
  return new URL(normaliseBaseUrl(baseUrl)).origin
}

/**
 * Expected `aud` claim: observed empirically (2026-10-08, TASK-6.4) to equal the issuer origin on
 * every token minted by this branch's Neon Auth instance, across separately-minted tokens for the
 * same user. There is no published guarantee this value is derived identically to `iss` for every
 * Neon project, so this is kept as its own function rather than aliased to `expectedIssuer`, even
 * though the two currently compute the same string.
 */
export function expectedAudience(baseUrl: string): string {
  return new URL(normaliseBaseUrl(baseUrl)).origin
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i

/** Returns the bearer token, or null when the header is missing or not a bearer credential. */
export function extractBearerToken(header: string | null): string | null {
  if (!header) {
    return null
  }
  const match = BEARER_PATTERN.exec(header.trim())
  return match ? match[1].trim() || null : null
}

/**
 * Maps an already-verified JWT payload to an `AuthenticatedUser`, or null if the payload has no
 * usable subject.
 *
 * Separated from `authenticate()` so this mapping — the one place a malformed or unexpected claim
 * shape could silently produce a bad identity — is unit-tested directly, rather than only
 * reachable through a real signature verification. `sub` is required because it is the stable,
 * always-present identifier (`neon_auth.user.id`); `email` and `name` are optional claims that
 * degrade to null rather than failing the whole request, since neither is used to make an
 * authorisation decision (AC-006a).
 */
export function derivePayloadUser(payload: JWTPayload): AuthenticatedUser | null {
  const subject = typeof payload.sub === 'string' ? payload.sub : null
  if (!subject) {
    return null
  }

  return {
    id: subject,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: typeof payload.name === 'string' ? payload.name : null,
  }
}

/**
 * The single 401 response shape for this Worker. Body carries no detail about why verification
 * failed — callers of `authenticate()` must not distinguish causes in the response, which would
 * leak information to an unauthenticated caller (AC-005).
 *
 * Takes no arguments and touches no `WorkerEnv`/`Request`, so — unlike `authenticate()` itself —
 * this exact response contract is unit-tested directly rather than only reachable through the
 * curl checks in TASK-2.6.
 */
export function unauthorized(): Response {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  )
}
