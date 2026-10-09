/**
 * Pure session-shape helpers for `AuthProvider.tsx`.
 *
 * Split out for the same reason `src/worker/auth-helpers.ts` and `api-core.ts` are split from
 * their callers: these functions touch nothing React- or browser-specific, so they can be
 * unit-tested directly under plain Node (`npm run test:client-auth`) without a DOM or a new test
 * dependency. `AuthProvider.tsx` imports them for both the mount-time session check and the
 * post-sign-in session fetch, so the "is this a valid session" rule is defined exactly once.
 */
import type { AuthUser } from './types.ts'

/** Shape of the `getSession()` / post-sign-in session payload `AuthProvider` relies on. */
export interface SessionResult {
  data: {
    session: unknown
    user?: { id: string; email?: string | null; name?: string | null }
  } | null
}

/** Shape of the `signIn.email()` result `AuthProvider` relies on. */
export interface SignInResult {
  error: { message?: string } | null
}

export type SessionOutcome = { status: 'authed'; user: AuthUser } | { status: 'anon'; user: null }

/** Shown when `signIn.email()` fails without a server-supplied message. */
export const DEFAULT_SIGN_IN_ERROR = 'Sign-in failed. Check your email and password.'

/** Shown when `signIn.email()` reports success but the follow-up session fetch is not usable. */
export const SESSION_NOT_ESTABLISHED_ERROR = 'Signed in, but no session was established. Try again.'

/**
 * Converts a raw `SessionResult` into the minimal, authoritative answer to "is someone signed in,
 * and who". A session is only treated as valid when BOTH `data.session` is truthy AND a `user` is
 * present — either alone is treated as anonymous, since a user without a session (or vice versa)
 * is not a state the client should act on as authenticated.
 *
 * Missing `email`/`name` claims on the user object are normalised to `null` here, once, so every
 * caller of `useAuth()` sees the same `AuthUser` shape regardless of which claims this particular
 * Neon Auth response happened to include.
 */
export function deriveSessionOutcome(result: SessionResult): SessionOutcome {
  const sessionUser = result.data?.user
  if (!result.data?.session || !sessionUser) {
    return { status: 'anon', user: null }
  }

  return {
    status: 'authed',
    user: {
      id: sessionUser.id,
      email: sessionUser.email ?? null,
      name: sessionUser.name ?? null,
    },
  }
}

/**
 * Normalises a thrown `signIn.email()` rejection into the same `SignInResult` shape as a
 * non-throwing failure, so `resolveSignIn` never needs to know which path produced it.
 *
 * Empirically (TASK-4.6 browser walkthrough against a live Neon Auth instance, 2026-10-08):
 * despite the adapter configuring Better Auth's `fetchOptions.throw: false`, its own
 * `customFetchImpl` throws a Supabase-style `AuthApiError` directly on any non-2xx response
 * (invalid credentials, unknown email) BEFORE Better Auth's `throw: false` handling ever sees it.
 * Without this normalisation the rejection is unhandled: `handleSubmit` never reaches
 * `setSubmitting(false)`, so the sign-in form hangs on "Signing in…" forever instead of showing
 * `role="alert"` text (breaking AC-003). Treating any thrown value the same way a `{ error }`
 * result is treated keeps `signIn`'s one error-handling path authoritative regardless of which
 * shape the client happens to produce on a given failure.
 */
export function toSignInResult(thrown: unknown): SignInResult {
  const message = thrown instanceof Error ? thrown.message : undefined
  return { error: { message } }
}

/**
 * Resolves `signIn.email()`'s result against the server session it should have established.
 *
 * Returns `null` on success (the caller should adopt `outcome.user`), or a user-facing error
 * message on any failure — including the edge case where Neon Auth reports a successful sign-in
 * but the immediate follow-up `getSession()` call does not yet reflect it.
 */
export function resolveSignIn(
  signInResult: SignInResult,
  sessionResult: SessionResult,
): { error: string | null; outcome: SessionOutcome } {
  if (signInResult.error) {
    return {
      error: signInResult.error.message ?? DEFAULT_SIGN_IN_ERROR,
      outcome: { status: 'anon', user: null },
    }
  }

  const outcome = deriveSessionOutcome(sessionResult)
  if (outcome.status === 'anon') {
    return { error: SESSION_NOT_ESTABLISHED_ERROR, outcome }
  }

  return { error: null, outcome }
}
