import type { AuthenticatedUser } from '../auth-types.ts'

/**
 * Returns the authenticated caller's identity.
 *
 * Exists for two reasons: it gives the client a documented way to obtain server-confirmed identity
 * without a hand-rolled round trip per feature (AC-006), and it is the route used to prove
 * server-side enforcement with `curl` (AC-005).
 *
 * The response is derived entirely from the verified token. It contains no field that could make
 * two admins see different content (AC-006a).
 */
export function handleMe(user: AuthenticatedUser): Response {
  return Response.json({ id: user.id, email: user.email, name: user.name })
}
