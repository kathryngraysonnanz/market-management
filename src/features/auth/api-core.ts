/**
 * Pure, dependency-injected core of `apiFetch`'s single-retry-on-401 behaviour.
 *
 * Split out from `api.ts` for the same reason `src/worker/auth.ts`'s pure helpers live in
 * `auth-helpers.ts`: this module imports nothing from `auth-client.ts` or `@lib/env`, so it
 * carries no `import.meta.env` dependency and can be exercised directly under plain Node
 * (`npm run test:client-auth` — no Vite, jsdom, or new test dependency required). `api.ts` wires
 * in the real browser `fetch` and the real Neon Auth token getter; tests wire in fakes.
 */

export interface ApiFetchDeps {
  /** The real `fetch`, or a test double. Only `Request`/`Response` semantics are relied on. */
  fetch: typeof fetch
  /** Returns a fresh bearer token, or null when no usable session exists. */
  getAccessToken: () => Promise<string | null>
  /** Called at most once per `apiFetchCore` call, only when retrying cannot recover access. */
  onSessionExpired: () => void
}

const AUTH_SCHEME = 'Bearer'

function withAuthorization(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('authorization', [AUTH_SCHEME, token].join(' '))
  return { ...init, headers }
}

/**
 * Attaches a bearer token to `path`/`init` and retries exactly once, with a freshly minted token,
 * if the first attempt comes back 401. The retry is capped at one, so an infinite refresh loop is
 * structurally impossible. `onSessionExpired` fires whenever the caller is left with no way to
 * reach `path` as an authenticated user: no token at all, or still-401 after the retry.
 *
 * A non-401 response (2xx, 403, 5xx, etc.) is returned to the caller unchanged on the first
 * attempt — only an expired token is treated as the retryable case.
 */
export async function apiFetchCore(
  deps: ApiFetchDeps,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await deps.getAccessToken()
  if (!token) {
    deps.onSessionExpired()
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const response = await deps.fetch(path, withAuthorization(init, token))

  if (response.status !== 401) {
    return response
  }

  const refreshed = await deps.getAccessToken()
  if (!refreshed) {
    deps.onSessionExpired()
    return response
  }

  const retried = await deps.fetch(path, withAuthorization(init, refreshed))
  if (retried.status === 401) {
    deps.onSessionExpired()
  }
  return retried
}
