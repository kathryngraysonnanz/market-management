/**
 * Unit tests for `classifyRoute`, the pure deny-by-default routing classification behind
 * `src/worker/index.ts`. Run with `npm run test:worker` (Node's built-in test runner — no new
 * dependency).
 *
 * This is the direct test of AC-005 (unauthenticated `/api/*` is rejected) and AC-007 (health
 * probes stay public) at the routing-decision level; `scripts/worker-auth.test.ts` and the manual
 * `curl` matrix (TASK-2.6) cover the rest of the dispatch — token verification and the actual
 * HTTP responses.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyRoute, DB_HEALTH_PATH, HEALTH_PATH, ME_PATH } from '../src/worker/routing.ts'

test('classifyRoute: /api/health is public', () => {
  assert.equal(classifyRoute(HEALTH_PATH), 'public')
})

test('classifyRoute: /api/db/health is public', () => {
  assert.equal(classifyRoute(DB_HEALTH_PATH), 'public')
})

test('classifyRoute: /api/me requires authentication', () => {
  assert.equal(classifyRoute(ME_PATH), 'protected')
})

test('classifyRoute: an unknown /api/* path is not-found, not silently public (AC-005)', () => {
  assert.equal(classifyRoute('/api/vendors'), 'not-found')
})

test('classifyRoute: a completely unrelated path is not-found', () => {
  assert.equal(classifyRoute('/'), 'not-found')
  assert.equal(classifyRoute('/index.html'), 'not-found')
})

test('classifyRoute: is exact-match only — a path merely prefixed by a known route is not-found', () => {
  assert.equal(classifyRoute('/api/health/extra'), 'not-found')
  assert.equal(classifyRoute('/api/mex'), 'not-found')
})

test('classifyRoute: trailing slash is a distinct, unmatched path (no implicit normalisation)', () => {
  assert.equal(classifyRoute(`${HEALTH_PATH}/`), 'not-found')
})

test('classifyRoute: empty string is not-found', () => {
  assert.equal(classifyRoute(''), 'not-found')
})
