/**
 * Pure result-shape handling for `auth-client.ts`'s `getAccessToken`.
 *
 * Split out for the same reason `api-core.ts` and `session.ts` are split from their callers:
 * `auth-client.ts` imports `@lib/env`, which reads `import.meta.env` — a Vite-only global
 * unavailable under the plain `node --test` runner this project already uses for
 * `scripts/*.test.ts`. This module touches nothing Vite- or browser-specific, so it can be
 * unit-tested directly (`npm run test:client-auth`).
 */

/** Shape of the `authClient.token()` result `getAccessToken` relies on. */
export interface TokenResult {
  // Empirically (TASK-4.6 browser walkthrough against a live Neon Auth instance, 2026-10-08): the
  // adapter's `onSuccess` hook copies the minted JWT from the `set-auth-jwt` response header onto
  // `data.session.token`, not onto a top-level `data.token` — because `token()` is implemented as
  // a thin wrapper around the same `getSession()` call the rest of this module already uses, and
  // that call's payload always nests the session under `session`. Reading a top-level `data.token`
  // here always produced `null`, so `getAccessToken()` silently returned no token on every call
  // even for a fully authenticated session, and every authenticated `/api/*` request failed with
  // 401 (AC-006 broken end-to-end despite every unit test for this module passing in isolation).
  data: { session: { token?: string | null } } | null
  error: { message?: string } | null
}

/**
 * Resolves a raw `TokenResult` to the usable token, or null when there is none to use.
 *
 * Treated as "no usable token" on any of: an explicit `error`, a null `data`, or an empty-string
 * `token` — the last of which Better Auth should never return, but an empty string is as useless
 * to an `Authorization` header as no token at all, so it is rejected here rather than forwarded.
 */
export function resolveAccessToken(result: TokenResult): string | null {
  const token = result.data?.session?.token
  if (result.error || !token) {
    return null
  }
  return token
}
