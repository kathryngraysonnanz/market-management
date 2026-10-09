/**
 * The signed-in user as the client knows them.
 *
 * Single-role by design: there is no `role` member and none may be added in this issue. Every
 * signed-in account is an admin and sees identical content (AC-006a).
 */
export interface AuthUser {
  id: string
  email: string | null
  name: string | null
}

/**
 * - `loading`       — the initial session check has not finished. Render nothing app-specific yet.
 * - `authed`        — a session exists; `user` is populated.
 * - `anon`          — no session. Show the sign-in experience.
 * - `expired`       — there WAS a session and it has since become invalid. Same gate as `anon`, but
 *                     the sign-in screen explains why the user is back there.
 * - `misconfigured` — `VITE_NEON_AUTH_URL` is unset. Show setup guidance, never a sign-in form that
 *                     cannot possibly work.
 */
export type AuthStatus = 'loading' | 'authed' | 'anon' | 'expired' | 'misconfigured'
