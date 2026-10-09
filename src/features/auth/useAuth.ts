import { useContext } from 'react'
import { AuthContext } from '@features/auth/auth-context'
import type { AuthContextValue } from '@features/auth/auth-context'

/**
 * The shared accessor for authentication state.
 *
 * This is the documented answer to "who is logged in" (AC-006): any component can call it, and no
 * feature needs to hand-roll its own identity round trip. Throws when used outside `AuthProvider`,
 * which turns a wiring mistake into an immediate, obvious failure instead of a silent null user.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
