/**
 * Guards the single most likely misconfiguration in Neon Auth integration (see
 * `src/features/auth/auth-client.ts`): the session cookie set by Neon Auth lives on a different
 * origin than this application, so every request the client library makes MUST carry
 * `credentials: 'include'` or the cookie is silently dropped — sign-in appears to succeed while
 * every subsequent call (including `authClient.token()`) silently fails.
 *
 * The installed `@neondatabase/neon-js` (0.5.0-beta) no longer exposes a `fetchOptions.credentials`
 * passthrough on `createAuthClient`. Its default adapter delegates to `better-auth/client`, whose
 * `getClientConfig` sets `credentials: 'include'` unconditionally when the runtime's `Request`
 * supports it (true in every target browser and in Node, which is what makes this test possible).
 * This test exercises the REAL dependency chain — not a reimplementation of its internals — so a
 * future upgrade of either package that drops this default is caught here instead of in production.
 *
 * Run with `npm run test:client-auth` (Node's built-in test runner).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthClient } from '@neondatabase/neon-js/auth'

test('the default Neon Auth client sends credentials: "include" on every request', async () => {
  const originalFetch = globalThis.fetch
  const capturedInits: RequestInit[] = []

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (init) {
      capturedInits.push(init)
    }
    return new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const client = createAuthClient('https://auth.example.invalid')
    await client.getSession()
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(capturedInits.length, 1, 'expected exactly one fetch call for getSession()')
  assert.equal(capturedInits[0].credentials, 'include')
})
