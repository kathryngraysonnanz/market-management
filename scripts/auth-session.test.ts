/**
 * Unit tests for the pure session-shape helpers behind `AuthProvider.tsx`
 * (`src/features/auth/session.ts`). Run with `npm run test:client-auth` (Node's built-in test
 * runner — no new dependency, no Vite/jsdom).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_SIGN_IN_ERROR,
  SESSION_NOT_ESTABLISHED_ERROR,
  deriveSessionOutcome,
  resolveSignIn,
  toSignInResult,
} from '../src/features/auth/session.ts'
import type { SessionResult, SignInResult } from '../src/features/auth/session.ts'

test('deriveSessionOutcome: session and user both present maps to authed with the full shape', () => {
  const result: SessionResult = {
    data: { session: { id: 's1' }, user: { id: 'u1', email: 'a@b.com', name: 'Ada' } },
  }

  const outcome = deriveSessionOutcome(result)

  assert.deepEqual(outcome, {
    status: 'authed',
    user: { id: 'u1', email: 'a@b.com', name: 'Ada' },
  })
})

test('deriveSessionOutcome: missing email and name claims are normalised to null, not undefined', () => {
  const result: SessionResult = {
    data: { session: { id: 's1' }, user: { id: 'u1' } },
  }

  const outcome = deriveSessionOutcome(result)

  assert.deepEqual(outcome, { status: 'authed', user: { id: 'u1', email: null, name: null } })
})

test('deriveSessionOutcome: data is null maps to anon', () => {
  const outcome = deriveSessionOutcome({ data: null })

  assert.deepEqual(outcome, { status: 'anon', user: null })
})

test('deriveSessionOutcome: session present but no user maps to anon', () => {
  const result: SessionResult = { data: { session: { id: 's1' } } }

  const outcome = deriveSessionOutcome(result)

  assert.deepEqual(outcome, { status: 'anon', user: null })
})

test('deriveSessionOutcome: user present but session is falsy maps to anon', () => {
  const result: SessionResult = {
    data: { session: null, user: { id: 'u1', email: 'a@b.com', name: 'Ada' } },
  }

  const outcome = deriveSessionOutcome(result)

  assert.deepEqual(outcome, { status: 'anon', user: null })
})

test('resolveSignIn: a sign-in error is surfaced verbatim and never reaches the session', () => {
  const signInResult: SignInResult = { error: { message: 'Invalid email or password.' } }
  const sessionResult: SessionResult = {
    data: { session: { id: 's1' }, user: { id: 'u1', email: null, name: null } },
  }

  const { error, outcome } = resolveSignIn(signInResult, sessionResult)

  assert.equal(error, 'Invalid email or password.')
  assert.deepEqual(outcome, { status: 'anon', user: null })
})

test('resolveSignIn: a sign-in error with no message falls back to the default copy', () => {
  const signInResult: SignInResult = { error: {} }
  const sessionResult: SessionResult = { data: null }

  const { error } = resolveSignIn(signInResult, sessionResult)

  assert.equal(error, DEFAULT_SIGN_IN_ERROR)
})

test('resolveSignIn: success with a confirmed session returns no error and the authed outcome', () => {
  const signInResult: SignInResult = { error: null }
  const sessionResult: SessionResult = {
    data: { session: { id: 's1' }, user: { id: 'u1', email: 'a@b.com', name: 'Ada' } },
  }

  const { error, outcome } = resolveSignIn(signInResult, sessionResult)

  assert.equal(error, null)
  assert.deepEqual(outcome, {
    status: 'authed',
    user: { id: 'u1', email: 'a@b.com', name: 'Ada' },
  })
})

test('resolveSignIn: success reported but the session fetch is not yet established reports the edge-case message', () => {
  const signInResult: SignInResult = { error: null }
  const sessionResult: SessionResult = { data: null }

  const { error, outcome } = resolveSignIn(signInResult, sessionResult)

  assert.equal(error, SESSION_NOT_ESTABLISHED_ERROR)
  assert.deepEqual(outcome, { status: 'anon', user: null })
})

test('toSignInResult: an Error thrown by signIn.email() carries its message through as a SignInResult', () => {
  const result = toSignInResult(new Error('Invalid email or password'))

  assert.deepEqual(result, { error: { message: 'Invalid email or password' } })
})

test('toSignInResult: a non-Error thrown value falls back to an undefined message, not a crash', () => {
  const result = toSignInResult('a plain string rejection')

  assert.deepEqual(result, { error: { message: undefined } })
})

test('toSignInResult: feeding its output into resolveSignIn reproduces the default-copy fallback', () => {
  const signInResult = toSignInResult('no message here')
  const sessionResult: SessionResult = { data: null }

  const { error } = resolveSignIn(signInResult, sessionResult)

  assert.equal(error, DEFAULT_SIGN_IN_ERROR)
})
