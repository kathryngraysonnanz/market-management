/**
 * The authenticated caller, as derived from a verified Neon Auth JWT.
 *
 * Deliberately minimal. This issue is single-role: every signed-in account is an admin, and no
 * field on this type may be used to vary behaviour or content between users (AC-006a). There is no
 * `role` member, and none should be added without a corresponding multi-role design — Neon's
 * Managed Better Auth does not support custom JWT claims, so a future role check would require a
 * database lookup rather than a claim.
 */
export interface AuthenticatedUser {
  /** Stable user ID. The JWT `sub` claim; equal to `neon_auth.user.id`. */
  id: string
  /** Email address, or null when the claim is absent. */
  email: string | null
  /** Display name, or null when the claim is absent. */
  name: string | null
}
