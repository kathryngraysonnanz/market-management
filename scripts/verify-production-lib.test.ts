/**
 * Unit tests for the pure verdict functions in `verify-production-lib.ts`. Run with
 * `npm run test:verify-prod` (Node's built-in test runner — no new dependency, no network call,
 * no live deployment required).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allPassed,
  checkCrossBranchTokenRejected,
  checkDbHealth,
  checkHealth,
  checkMeRejectsGarbageToken,
  checkMeRequiresAuth,
  checkMeReturnsIdentity,
  scanBundleForSecrets,
  scanTrackedSourceForRealAuthUrl,
} from './verify-production-lib.ts'

test('checkHealth: 200 with ok:true passes', () => {
  const check = checkHealth(200, { ok: true })
  assert.equal(check.status, 'pass')
  assert.equal(check.row, 3)
})

test('checkHealth: non-200 fails', () => {
  assert.equal(checkHealth(500, { ok: true }).status, 'fail')
})

test('checkHealth: 200 with a falsy ok fails', () => {
  assert.equal(checkHealth(200, { ok: false }).status, 'fail')
  assert.equal(checkHealth(200, {}).status, 'fail')
  assert.equal(checkHealth(200, null).status, 'fail')
})

test('checkDbHealth: 200 with ok:true and a now timestamp passes', () => {
  const check = checkDbHealth(200, { ok: true, now: '2026-10-08T00:00:00Z' })
  assert.equal(check.status, 'pass')
  assert.equal(check.row, 4)
})

test('checkDbHealth: missing now fails even if ok is true', () => {
  assert.equal(checkDbHealth(200, { ok: true }).status, 'fail')
})

test('checkDbHealth: non-200 fails', () => {
  assert.equal(checkDbHealth(503, { ok: true, now: '…' }).status, 'fail')
})

test('checkMeRequiresAuth: 401 with the exact fixed body passes', () => {
  const check = checkMeRequiresAuth(401, { error: 'unauthorized' })
  assert.equal(check.status, 'pass')
  assert.equal(check.row, 5)
})

test('checkMeRequiresAuth: a 200 — auth not actually enforced — fails', () => {
  assert.equal(checkMeRequiresAuth(200, { id: 'leaked' }).status, 'fail')
})

test('checkMeRequiresAuth: a 401 with a cause-specific body fails — would leak information', () => {
  assert.equal(checkMeRequiresAuth(401, { error: 'token expired' }).status, 'fail')
})

test('checkMeRejectsGarbageToken: 401 passes', () => {
  assert.equal(checkMeRejectsGarbageToken(401).status, 'pass')
})

test('checkMeRejectsGarbageToken: anything else fails', () => {
  assert.equal(checkMeRejectsGarbageToken(200).status, 'fail')
  assert.equal(checkMeRejectsGarbageToken(500).status, 'fail')
})

test('checkCrossBranchTokenRejected: skipped when no token is supplied', () => {
  const check = checkCrossBranchTokenRejected(0, false)
  assert.equal(check.status, 'skip')
  assert.equal(check.row, 7)
})

test('checkCrossBranchTokenRejected: 401 with a token passes', () => {
  assert.equal(checkCrossBranchTokenRejected(401, true).status, 'pass')
})

test('checkCrossBranchTokenRejected: a 200 — branch isolation broken — fails', () => {
  assert.equal(checkCrossBranchTokenRejected(200, true).status, 'fail')
})

test('checkMeReturnsIdentity: skipped when no token is supplied', () => {
  const check = checkMeReturnsIdentity(0, null, false)
  assert.equal(check.status, 'skip')
  assert.equal(check.row, 12)
})

test('checkMeReturnsIdentity: 200 with a non-empty id passes', () => {
  const check = checkMeReturnsIdentity(200, { id: 'user_1', email: null, name: null }, true)
  assert.equal(check.status, 'pass')
})

test('checkMeReturnsIdentity: 200 with an empty-string id fails', () => {
  assert.equal(checkMeReturnsIdentity(200, { id: '' }, true).status, 'fail')
})

test('checkMeReturnsIdentity: a 401 with a valid token fails', () => {
  assert.equal(checkMeReturnsIdentity(401, { error: 'unauthorized' }, true).status, 'fail')
})

test('scanBundleForSecrets: no files is a skip, not a pass', () => {
  const check = scanBundleForSecrets(new Map())
  assert.equal(check.status, 'skip')
  assert.equal(check.row, 14)
})

test('scanBundleForSecrets: clean bundle passes', () => {
  const files = new Map([['index-abc.js', 'const x=1;console.log(x)']])
  assert.equal(scanBundleForSecrets(files).status, 'pass')
})

test('scanBundleForSecrets: a Neon secret server key fails the scan', () => {
  const files = new Map([['index-abc.js', 'const k="ssk_abc123XYZ"']])
  assert.equal(scanBundleForSecrets(files).status, 'fail')
})

test('scanBundleForSecrets: a postgres connection string fails the scan', () => {
  const files = new Map([['index-abc.js', 'postgresql://user:pass@host/db']])
  assert.equal(scanBundleForSecrets(files).status, 'fail')
})

test('scanBundleForSecrets: a neon_auth schema reference fails the scan', () => {
  const files = new Map([['index-abc.js', 'select * from neon_auth.user']])
  assert.equal(scanBundleForSecrets(files).status, 'fail')
})

test('scanBundleForSecrets: the public VITE_NEON_AUTH_URL host itself is not flagged', () => {
  const files = new Map([
    ['index-abc.js', 'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech/neondb/auth'],
  ])
  assert.equal(scanBundleForSecrets(files).status, 'pass')
})

test('scanTrackedSourceForRealAuthUrl: no matches at all passes', () => {
  assert.equal(scanTrackedSourceForRealAuthUrl([]).status, 'pass')
})

test('scanTrackedSourceForRealAuthUrl: matches containing only the documented placeholder pass', () => {
  const lines = [
    '.env.example:10:VITE_NEON_AUTH_URL="https://ep-example-123456.neonauth.region.aws.neon.tech/db/auth"',
  ]
  assert.equal(scanTrackedSourceForRealAuthUrl(lines).status, 'pass')
})

test('scanTrackedSourceForRealAuthUrl: a real, non-placeholder URL fails', () => {
  const lines = [
    'src/leaked.ts:3:const url = "https://ep-real-9f8a2b.neonauth.us-east-2.aws.neon.tech/neondb/auth"',
  ]
  assert.equal(scanTrackedSourceForRealAuthUrl(lines).status, 'fail')
})

test('allPassed: true when every result is pass or skip', () => {
  assert.equal(
    allPassed([
      { row: 1, description: 'a', status: 'pass', detail: '' },
      { row: 2, description: 'b', status: 'skip', detail: '' },
    ]),
    true,
  )
})

test('allPassed: false when any result fails, regardless of position', () => {
  assert.equal(
    allPassed([
      { row: 1, description: 'a', status: 'pass', detail: '' },
      { row: 2, description: 'b', status: 'fail', detail: '' },
      { row: 3, description: 'c', status: 'pass', detail: '' },
    ]),
    false,
  )
})
