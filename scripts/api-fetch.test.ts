/**
 * Unit tests for `apiFetchCore`, the pure single-retry-on-401 orchestration behind
 * `src/features/auth/api.ts`. Run with `npm run test:client-auth` (Node's built-in test runner —
 * no new dependency, no Vite/jsdom).
 *
 * `api-core.ts` imports nothing from `auth-client.ts` or `@lib/env`, so it carries no
 * `import.meta.env` dependency and loads fine under plain Node; `fetch` and `getAccessToken` are
 * supplied as fakes here instead of the real browser/Neon Auth implementations.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiFetchCore } from '../src/features/auth/api-core.ts'
import type { ApiFetchDeps } from '../src/features/auth/api-core.ts'

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface RecordedCall {
  path: string
  authorization: string | null
  init?: RequestInit
}

interface MakeDepsOptions {
  /** Produces the response for each `fetch` call; defaults to always-200. Still fully recorded. */
  respond?: (call: RecordedCall) => Response | Promise<Response>
  /** Produces the token for each `getAccessToken` call; defaults to always `'token-1'`. */
  getAccessToken?: ApiFetchDeps['getAccessToken']
}

/**
 * Builds a `deps` object with sane defaults. `respond`/`getAccessToken` customise behaviour while
 * `calls` and `expiredCount` always observe every invocation — unlike overriding `deps.fetch`
 * directly, which would silently stop recording calls.
 */
function makeDeps(options: MakeDepsOptions = {}): {
  deps: ApiFetchDeps
  expiredCount: () => number
  calls: RecordedCall[]
} {
  let expiredCount = 0
  const calls: RecordedCall[] = []
  const respond = options.respond ?? (() => jsonResponse(200))

  const deps: ApiFetchDeps = {
    fetch: async (input, init) => {
      const call: RecordedCall = {
        path: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
        init,
      }
      calls.push(call)
      return respond(call)
    },
    getAccessToken: options.getAccessToken ?? (async () => 'token-1'),
    onSessionExpired: () => {
      expiredCount += 1
    },
  }

  return { deps, expiredCount: () => expiredCount, calls }
}

test('apiFetchCore: attaches a bearer token and returns a successful response untouched', async () => {
  const { deps, calls, expiredCount } = makeDeps()

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].authorization, 'Bearer token-1')
  assert.equal(expiredCount(), 0)
})

test('apiFetchCore: no token at all reports expiry and returns 401 without calling fetch', async () => {
  const { deps, calls, expiredCount } = makeDeps({ getAccessToken: async () => null })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 401)
  assert.equal(calls.length, 0)
  assert.equal(expiredCount(), 1)
})

test('apiFetchCore: a non-401 failure (403) is returned on the first attempt, no retry', async () => {
  const { deps, calls, expiredCount } = makeDeps({
    respond: () => jsonResponse(403),
  })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 403)
  assert.equal(calls.length, 1)
  assert.equal(expiredCount(), 0)
})

test('apiFetchCore: a 500 is returned on the first attempt, no retry', async () => {
  const { deps, calls } = makeDeps({ respond: () => jsonResponse(500) })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 500)
  assert.equal(calls.length, 1)
})

test('apiFetchCore: an expired token on the first attempt is retried once with a fresh token', async () => {
  let tokenCalls = 0
  const expectedStale = ['Bearer', 'stale-token'].join(' ')
  const expectedFresh = ['Bearer', 'fresh-token'].join(' ')
  const { deps, calls, expiredCount } = makeDeps({
    getAccessToken: async () => {
      tokenCalls += 1
      return tokenCalls === 1 ? 'stale-token' : 'fresh-token'
    },
    respond: (call) =>
      call.authorization === expectedStale ? jsonResponse(401) : jsonResponse(200),
  })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].authorization, expectedStale)
  assert.equal(calls[1].authorization, expectedFresh)
  assert.equal(expiredCount(), 0)
})

test('apiFetchCore: the retry is capped at one — still-401 after refresh reports expiry', async () => {
  const { deps, calls, expiredCount } = makeDeps({
    respond: () => jsonResponse(401),
  })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 401)
  // Exactly two fetches: the original attempt and the single retry — never a third.
  assert.equal(calls.length, 2)
  assert.equal(expiredCount(), 1)
})

test('apiFetchCore: 401 followed by no refreshable token reports expiry without a second fetch', async () => {
  let tokenCalls = 0
  const { deps, calls, expiredCount } = makeDeps({
    getAccessToken: async () => {
      tokenCalls += 1
      return tokenCalls === 1 ? 'stale-token' : null
    },
    respond: () => jsonResponse(401),
  })

  const response = await apiFetchCore(deps, '/api/me')

  assert.equal(response.status, 401)
  assert.equal(calls.length, 1)
  assert.equal(expiredCount(), 1)
})

test('apiFetchCore: forwards method, body and extra headers unchanged', async () => {
  const { deps, calls } = makeDeps({
    respond: (call) => {
      const headers = new Headers(call.init?.headers)
      assert.equal(call.init?.method, 'POST')
      assert.equal(headers.get('content-type'), 'application/json')
      assert.equal(call.init?.body, '{"name":"vendor"}')
      return jsonResponse(200)
    },
  })

  const response = await apiFetchCore(deps, '/api/vendors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"vendor"}',
  })

  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
})
