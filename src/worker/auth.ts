/**
 * Server-side authentication for this Worker.
 *
 * Neon Auth sets its session cookie on the *Neon* origin, which this Worker's origin can never
 * read. The client therefore sends a short-lived JWT (15 minutes, EdDSA) in the Authorization
 * header, and this module verifies it locally against the branch's public JWKS.
 *
 * Local verification is used rather than a call to the auth service per request: it adds no network
 * hop to the hot path and requires no secret in the Worker, because JWKS keys are public. The cost
 * is that a revoked user's already-issued token stays valid until it expires — bounded at 15
 * minutes by Neon's fixed token lifetime. See .forge/work/job_5/code/research.md §4.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AuthenticatedUser } from './auth-types.ts'
import {
  derivePayloadUser,
  expectedAudience,
  expectedIssuer,
  extractBearerToken,
  normaliseBaseUrl,
} from './auth-helpers.ts'
import type { WorkerEnv } from './types.ts'

export {
  derivePayloadUser,
  expectedAudience,
  expectedIssuer,
  extractBearerToken,
  normaliseBaseUrl,
  unauthorized,
} from './auth-helpers.ts'

/**
 * One JWKS fetcher per base URL, cached at module scope so a warm isolate fetches the key set once
 * rather than once per request. `createRemoteJWKSet` re-fetches by itself when it sees an unknown
 * `kid`, so key rotation needs no handling here.
 */
const jwksByBaseUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(baseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const normalised = normaliseBaseUrl(baseUrl)
  const cached = jwksByBaseUrl.get(normalised)
  if (cached) {
    return cached
  }
  const jwks = createRemoteJWKSet(new URL(`${normalised}/.well-known/jwks.json`))
  jwksByBaseUrl.set(normalised, jwks)
  return jwks
}

/**
 * Verifies the request's bearer token.
 *
 * Returns the authenticated user, or null for any failure whatsoever — missing header, malformed
 * token, bad signature, wrong issuer, expired, or JWKS unreachable. Callers must treat null as 401
 * and must not distinguish between causes in the response, which would leak information to an
 * unauthenticated caller.
 */
export async function authenticate(
  request: Request,
  env: WorkerEnv,
): Promise<AuthenticatedUser | null> {
  if (!env.NEON_AUTH_BASE_URL) {
    console.error('auth: NEON_AUTH_BASE_URL is not configured')
    return null
  }

  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(env.NEON_AUTH_BASE_URL), {
      // Observed empirically on 2026-10-08 (TASK-6.4): `aud` is present on every token minted by
      // this Neon Auth instance and equals the issuer origin, stable across separately-minted
      // tokens for the same user. Asserting it closes the gap left by Neon's own reference
      // implementation, which verifies `issuer` only — see research.md §9, U2.
      issuer: expectedIssuer(env.NEON_AUTH_BASE_URL),
      audience: expectedAudience(env.NEON_AUTH_BASE_URL),
      // Pinning the algorithm closes the algorithm-confusion class of attack. Neon fixes EdDSA
      // (Ed25519) for Managed Better Auth and does not allow it to be configured.
      algorithms: ['EdDSA'],
    })

    return derivePayloadUser(payload)
  } catch (error) {
    // Server-side only, captured by Cloudflare observability. Log the error CLASS only: the message
    // and the token itself are both credential-adjacent and must never be logged or returned.
    console.error('auth: token verification failed', (error as Error).name)
    return null
  }
}
