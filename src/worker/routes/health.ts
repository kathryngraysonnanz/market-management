/** Liveness probe. Proves the Worker is deployed and `/api/*` routing works. Touches no dependency. */
export function handleHealth(): Response {
  return Response.json({ ok: true, service: 'market-management' })
}
