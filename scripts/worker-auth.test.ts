/**
 * Unit tests for the pure helpers in `src/worker/auth.ts` and `src/worker/auth-helpers.ts`. Run
 * with `npm run test:worker` (Node's built-in test runner — no new dependency).
 *
 * Placed under `scripts/` rather than `src/worker/` on purpose: `tsconfig.worker.json` declares
 * only the Workers types, so a test file there could not see `node:test`, while `scripts/**` is
 * already covered by `tsconfig.node.json`. The cryptographic signature check itself (`jwtVerify`
 * against a live JWKS endpoint) is not unit-tested here because it requires a reachable Neon Auth
 * instance; it is covered by the curl checks in TASK-2.6. Everything downstream of a successful
 * verification — mapping the resulting payload to an `AuthenticatedUser` — is pure and is tested
 * below via `derivePayloadUser`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  derivePayloadUser,
  expectedAudience,
  expectedIssuer,
  extractBearerToken,
  normaliseBaseUrl,
  unauthorized,
} from '../src/worker/auth-helpers.ts'

const BASE = 'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech/neondb/auth'

test('normaliseBaseUrl: strips trailing slashes', () => {
  assert.equal(normaliseBaseUrl(BASE), BASE)
  assert.equal(normaliseBaseUrl(`${BASE}/`), BASE)
  assert.equal(normaliseBaseUrl(`${BASE}///`), BASE)
})

test('expectedIssuer: returns the origin, dropping the path', () => {
  assert.equal(expectedIssuer(BASE), 'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech')
  assert.equal(
    expectedIssuer(`${BASE}/`),
    'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech',
  )
})

test('expectedAudience: returns the origin, dropping the path — observed equal to the issuer (U2)', () => {
  assert.equal(expectedAudience(BASE), 'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech')
  assert.equal(expectedAudience(BASE), expectedIssuer(BASE))
})

test('extractBearerToken: accepts a well-formed header', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
})

test('extractBearerToken: scheme is case-insensitive', () => {
  assert.equal(extractBearerToken('bearer abc.def.ghi'), 'abc.def.ghi')
})

test('extractBearerToken: tolerates surrounding whitespace', () => {
  assert.equal(extractBearerToken('  Bearer abc.def.ghi  '), 'abc.def.ghi')
})

test('extractBearerToken: rejects missing, empty and non-bearer headers', () => {
  assert.equal(extractBearerToken(null), null)
  assert.equal(extractBearerToken(''), null)
  assert.equal(extractBearerToken('Bearer'), null)
  assert.equal(extractBearerToken('Bearer    '), null)
  assert.equal(extractBearerToken('Basic abc'), null)
  assert.equal(extractBearerToken('abc.def.ghi'), null)
})

test('derivePayloadUser: a full payload maps id/email/name straight through', () => {
  assert.deepEqual(
    derivePayloadUser({ sub: 'user_123', email: 'admin@example.com', name: 'Admin' }),
    {
      id: 'user_123',
      email: 'admin@example.com',
      name: 'Admin',
    },
  )
})

test('derivePayloadUser: missing email and name claims are reported as null, not undefined', () => {
  assert.deepEqual(derivePayloadUser({ sub: 'user_123' }), {
    id: 'user_123',
    email: null,
    name: null,
  })
})

test('derivePayloadUser: a non-string sub is treated the same as a missing one', () => {
  // A verified token should never carry a non-string `sub`, but the payload is attacker-influenced
  // input up to the point of signature verification, so this boundary is defensive rather than
  // merely theoretical.
  assert.equal(derivePayloadUser({ sub: 12345 as unknown as string }), null)
})

test('derivePayloadUser: an empty-string sub is rejected, not treated as a valid id', () => {
  assert.equal(derivePayloadUser({ sub: '' }), null)
})

test('derivePayloadUser: a missing sub returns null', () => {
  assert.equal(derivePayloadUser({}), null)
})

test('derivePayloadUser: non-string email and name claims are normalised to null, not passed through', () => {
  assert.deepEqual(
    derivePayloadUser({
      sub: 'user_123',
      email: 42 as unknown as string,
      name: true as unknown as string,
    }),
    { id: 'user_123', email: null, name: null },
  )
})

test('unauthorized: returns 401 with the fixed error body and a www-authenticate challenge', async () => {
  const response = unauthorized()
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('www-authenticate'), 'Bearer')
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('unauthorized: body never varies between calls — no cause-specific detail leaks through', async () => {
  const first = await unauthorized().json()
  const second = await unauthorized().json()
  assert.deepEqual(first, second)
})
