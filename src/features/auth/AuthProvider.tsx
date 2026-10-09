import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authClient, isAuthConfigured } from '@features/auth/auth-client'
import { AuthContext } from '@features/auth/auth-context'
import type { AuthContextValue } from '@features/auth/auth-context'
import { setSessionExpiredHandler } from '@features/auth/api'
import {
  DEFAULT_SIGN_IN_ERROR,
  deriveSessionOutcome,
  resolveSignIn,
  toSignInResult,
} from '@features/auth/session'
import type { SessionResult, SignInResult } from '@features/auth/session'
import type { AuthStatus, AuthUser } from '@features/auth/types'

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(isAuthConfigured ? 'loading' : 'misconfigured')
  const [user, setUser] = useState<AuthUser | null>(null)

  // One session check on mount. This is the only thing gating first paint: the JWT is fetched
  // lazily by apiFetch when a request actually needs one, so it stays off the critical path and a
  // returning admin sees no extra loading step (Performance NFR).
  useEffect(() => {
    if (!isAuthConfigured) {
      return
    }
    let active = true

    ;(authClient.getSession() as Promise<SessionResult>)
      .then((result) => {
        if (!active) return
        const outcome = deriveSessionOutcome(result)
        setUser(outcome.user)
        setStatus(outcome.status)
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setStatus('anon')
      })

    return () => {
      active = false
    }
  }, [])

  // apiFetch reports an unrecoverable 401 here. Treated as expiry rather than plain sign-out so the
  // sign-in screen can explain what happened instead of appearing for no visible reason.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setStatus('expired')
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    // `signIn.email()` is expected to resolve with `{ error }` on a bad credential, never reject —
    // but it does reject in practice (see `toSignInResult`'s doc comment), so every failure path is
    // funnelled through the same `SignInResult` shape before anything downstream looks at it.
    let signInResult: SignInResult
    try {
      signInResult = (await authClient.signIn.email({ email, password })) as SignInResult
    } catch (thrown) {
      signInResult = toSignInResult(thrown)
    }
    if (signInResult.error) {
      // No follow-up session fetch on a failed attempt — there is nothing to confirm yet, and a
      // failed credential check should not cost an extra round trip.
      return signInResult.error.message ?? DEFAULT_SIGN_IN_ERROR
    }

    const sessionResult = (await authClient.getSession()) as SessionResult
    const { error, outcome } = resolveSignIn(signInResult, sessionResult)
    setUser(outcome.user)
    setStatus(outcome.status)
    return error
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut()
    } finally {
      // Cleared in `finally` on purpose: a failed network call must still end the local session.
      // Leaving a user "signed in" locally because sign-out errored is exactly the stale-data
      // hazard this feature has to avoid.
      setUser(null)
      setStatus('anon')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
