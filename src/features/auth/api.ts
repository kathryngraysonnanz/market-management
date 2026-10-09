/**
 * The single way application code calls this project's own `/api/*` routes.
 *
 * Attaches a fresh Neon Auth JWT, and handles the one failure mode that is guaranteed to occur in
 * normal use: access tokens live 15 minutes, so a dashboard left open will certainly hit an expired
 * token. Rather than surfacing a raw 401, this retries exactly once with a newly minted token,
 * which succeeds whenever the underlying session cookie is still valid. The user sees nothing.
 *
 * The retry/expiry orchestration itself lives in `api-core.ts` as a plain, dependency-injected
 * function so it can be unit-tested without a browser — this module just wires in the real
 * `fetch` and the real Neon Auth token getter. See `scripts/api-fetch.test.ts`.
 */
import { getAccessToken } from '@features/auth/auth-client'
import { apiFetchCore } from '@features/auth/api-core'

type SessionExpiredHandler = () => void

let sessionExpiredHandler: SessionExpiredHandler | null = null

/** Registered by AuthProvider. Called when a request is still 401 after one refreshed retry. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return apiFetchCore(
    {
      fetch: (...args) => fetch(...args),
      getAccessToken,
      onSessionExpired: () => sessionExpiredHandler?.(),
    },
    path,
    init,
  )
}
