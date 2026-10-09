/**
 * The single configured Neon Auth (Managed Better Auth) client for this application.
 *
 * Neon Auth runs on its own origin, not this application's. This means the Neon Auth session
 * cookie is a cross-origin (third-party) cookie from the Worker's point of view, which is why the
 * Worker can never read it directly (see `src/worker/auth.ts`) and why the client instead mints a
 * short-lived JWT via `authClient.token()` to send with each API call.
 *
 * No secret of any kind belongs here. Managed Better Auth needs only a public base URL — there is
 * no publishable key and no client key to configure.
 *
 * `credentials: 'include'` is mandatory for the cross-origin cookie above to be sent, but it is
 * NOT passed explicitly below: the installed `@neondatabase/neon-js` (0.7.0-beta) `NeonAuthConfig`
 * type exposes only `adapter` and `allowAnonymous`, with no `fetchOptions.credentials` passthrough
 * (verified against `@neondatabase/auth@0.7.0-beta`, which `neon-js/auth` re-exports). Its default
 * adapter, `BetterAuthVanillaAdapter`, delegates to `better-auth/client`'s `createAuthClient`,
 * whose `getClientConfig` (node_modules/better-auth/dist/client/config.mjs) sets
 * `credentials: 'include'` unconditionally whenever the runtime's `Request` supports it — true in
 * every browser this app targets. Verify this still holds after any upgrade of either package.
 * Authoritative declarations live in `node_modules/@neondatabase/auth/dist/index.d.mts`, not in
 * `neon-js`.
 */
import { createAuthClient } from '@neondatabase/neon-js/auth'
import { env } from '@lib'
import { resolveAccessToken } from '@features/auth/token'
import type { TokenResult } from '@features/auth/token'

/** True when `VITE_NEON_AUTH_URL` is set. False renders the setup screen instead of the app. */
export const isAuthConfigured = env.neonAuthUrl !== ''

/**
 * The JWT-minting method (`.token()`) is generated at runtime by the underlying Better Auth proxy
 * client from the server's `/token` endpoint and is not part of `@neondatabase/neon-js`'s current
 * (pre-1.0) published type declarations. This narrow, local interface describes only the shape this
 * module relies on, so the rest of the codebase never needs an `any`/unsafe cast.
 */
interface TokenCapableClient {
  token: () => Promise<TokenResult>
}

export const authClient = createAuthClient(env.neonAuthUrl || 'https://unconfigured.invalid')

/**
 * Returns a fresh short-lived JWT for the signed-in user, or null when there is no usable session.
 *
 * Tokens live 15 minutes and are minted on demand from the long-lived session cookie, so callers
 * should request one per call rather than caching it. Never log or persist the returned value.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const result = await (authClient as unknown as TokenCapableClient).token()
    return resolveAccessToken(result)
  } catch {
    return null
  }
}
