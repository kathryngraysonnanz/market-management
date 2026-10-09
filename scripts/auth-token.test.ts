/**
 * Unit tests for `src/features/auth/token.ts`. Run with `npm run test:client-auth` (Node's
 * built-in test runner — no new dependency).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveAccessToken } from '../src/features/auth/token.ts'

test('resolveAccessToken: a successful result returns the token nested under data.session.token', () => {
  assert.equal(
    resolveAccessToken({ data: { session: { token: 'abc.def.ghi' } }, error: null }),
    'abc.def.ghi',
  )
})

test('resolveAccessToken: an explicit error returns null even if a token is also present', () => {
  assert.equal(
    resolveAccessToken({
      data: { session: { token: 'abc.def.ghi' } },
      error: { message: 'expired' },
    }),
    null,
  )
})

test('resolveAccessToken: null data returns null', () => {
  assert.equal(resolveAccessToken({ data: null, error: null }), null)
})

test('resolveAccessToken: a session present with no token returns null', () => {
  assert.equal(resolveAccessToken({ data: { session: {} }, error: null }), null)
})

test('resolveAccessToken: an empty-string token is treated as no usable token', () => {
  assert.equal(resolveAccessToken({ data: { session: { token: '' } }, error: null }), null)
})
