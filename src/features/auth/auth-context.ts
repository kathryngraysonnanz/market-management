import { createContext } from 'react'
import type { AuthStatus, AuthUser } from '@features/auth/types'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  /** Signs in with email and password. Resolves to an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Signs out and clears local state. Always clears locally, even if the network call fails. */
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
