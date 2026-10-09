/**
 * Unit tests for the pure logic in `migrate-lib.ts`. Run with `npm run test:migrate`
 * (Node's built-in test runner — no new dependency).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyEndpoint,
  describeError,
  diffMigrations,
  parseArgs,
  parseMigrationFilename,
  validateMigrationFilenames,
} from './migrate-lib.ts'

test('parseArgs: no flags', () => {
  const result = parseArgs([])
  assert.deepEqual(result, { ok: true, args: { status: false, dryRun: false } })
})

test('parseArgs: --status', () => {
  const result = parseArgs(['--status'])
  assert.deepEqual(result, { ok: true, args: { status: true, dryRun: false } })
})

test('parseArgs: --dry-run', () => {
  const result = parseArgs(['--dry-run'])
  assert.deepEqual(result, { ok: true, args: { status: false, dryRun: true } })
})

test('parseArgs: both flags together', () => {
  const result = parseArgs(['--dry-run', '--status'])
  assert.deepEqual(result, { ok: true, args: { status: true, dryRun: true } })
})

test('parseArgs: unknown flag is reported, not thrown', () => {
  const result = parseArgs(['--bogus'])
  assert.deepEqual(result, { ok: false, unknownFlag: '--bogus' })
})

test('parseArgs: first unknown flag wins when several are present', () => {
  const result = parseArgs(['--status', '--nope', '--dry-run'])
  assert.deepEqual(result, { ok: false, unknownFlag: '--nope' })
})

test('classifyEndpoint: direct endpoint is accepted, only the hostname is surfaced', () => {
  const result = classifyEndpoint(
    'postgresql://user:hunter2@ep-example-123456.us-east-1.aws.neon.tech/db?sslmode=require',
  )
  assert.deepEqual(result, { ok: true, hostname: 'ep-example-123456.us-east-1.aws.neon.tech' })
})

test('classifyEndpoint: pooled endpoint is refused (AC-006)', () => {
  const result = classifyEndpoint(
    'postgresql://user:hunter2@ep-example-123456-pooler.us-east-1.aws.neon.tech/db',
  )
  assert.deepEqual(result, {
    ok: false,
    reason: 'pooled',
    hostname: 'ep-example-123456-pooler.us-east-1.aws.neon.tech',
  })
})

test('classifyEndpoint: malformed connection string is rejected without throwing', () => {
  const result = classifyEndpoint('not a url')
  assert.deepEqual(result, { ok: false, reason: 'invalid-url' })
})

test('classifyEndpoint: empty string is rejected without throwing', () => {
  const result = classifyEndpoint('')
  assert.deepEqual(result, { ok: false, reason: 'invalid-url' })
})

test('parseMigrationFilename: valid filename splits into version and name', () => {
  assert.deepEqual(parseMigrationFilename('0001_init.sql'), { version: '0001', name: 'init' })
  assert.deepEqual(parseMigrationFilename('0042_add-weather-cache.sql'), {
    version: '0042',
    name: 'add-weather-cache',
  })
})

test('parseMigrationFilename: rejects names that do not match NNNN_description.sql', () => {
  for (const filename of [
    'init.sql', // no version prefix
    '001_init.sql', // only 3 digits
    '00001_init.sql', // 5 digits
    '0001-init.sql', // wrong separator
    '0001_Init.sql', // uppercase not allowed
    '0001_init.SQL', // wrong extension case
    '0001_init.txt', // wrong extension
    '0001_.sql', // empty description
  ]) {
    assert.equal(parseMigrationFilename(filename), null, filename)
  }
})

test('validateMigrationFilenames: a clean, sorted list has no issues', () => {
  const result = validateMigrationFilenames(['0001_init.sql', '0002_add-markets-index.sql'])
  assert.deepEqual(result, { invalid: [], duplicates: [] })
})

test('validateMigrationFilenames: reports every invalid filename', () => {
  const result = validateMigrationFilenames(['0001_init.sql', 'BadName.sql', 'also-bad.sql'])
  assert.deepEqual(result.invalid, ['BadName.sql', 'also-bad.sql'])
  assert.deepEqual(result.duplicates, [])
})

test('validateMigrationFilenames: reports a duplicate version prefix with both filenames', () => {
  const result = validateMigrationFilenames(['0001_init.sql', '0001_also-init.sql'])
  assert.deepEqual(result.invalid, [])
  assert.deepEqual(result.duplicates, [
    { version: '0001', files: ['0001_init.sql', '0001_also-init.sql'] },
  ])
})

test('validateMigrationFilenames: three-way duplicate prefix lists all three files', () => {
  const result = validateMigrationFilenames([
    '0001_a.sql',
    '0001_b.sql',
    '0001_c.sql',
    '0002_ok.sql',
  ])
  assert.deepEqual(result.duplicates, [
    { version: '0001', files: ['0001_a.sql', '0001_b.sql', '0001_c.sql'] },
  ])
})

test('validateMigrationFilenames: empty input is valid', () => {
  assert.deepEqual(validateMigrationFilenames([]), { invalid: [], duplicates: [] })
})

test('describeError: plain Error returns its message', () => {
  assert.equal(describeError(new Error('boom')), 'boom')
})

test('describeError: non-Error values are stringified', () => {
  assert.equal(describeError('boom'), 'boom')
  assert.equal(describeError(42), '42')
  assert.equal(describeError(null), 'null')
  assert.equal(describeError(undefined), 'undefined')
})

test('describeError: unwraps an ErrorEvent-shaped object (WebSocket connection failures)', () => {
  const inner = new TypeError('connect ECONNREFUSED')
  assert.equal(describeError({ error: inner }), 'connect ECONNREFUSED')
})

test('describeError: ErrorEvent-shaped object whose .error is not an Error falls back to String()', () => {
  const value = { error: 'not an error instance' }
  assert.equal(describeError(value), String(value))
})

test('diffMigrations: no applied rows means every migration is pending', () => {
  const migrations = [
    { version: '0001', checksum: 'a' },
    { version: '0002', checksum: 'b' },
  ]
  const result = diffMigrations(migrations, new Map())
  assert.deepEqual(result.pending, migrations)
  assert.deepEqual(result.mismatched, [])
})

test('diffMigrations: a migration with a matching ledger checksum is neither pending nor mismatched', () => {
  const migrations = [{ version: '0001', checksum: 'a' }]
  const applied = new Map([['0001', { checksum: 'a' }]])
  const result = diffMigrations(migrations, applied)
  assert.deepEqual(result.pending, [])
  assert.deepEqual(result.mismatched, [])
})

test('diffMigrations: a ledger row with a different checksum is reported as mismatched, not pending', () => {
  const migrations = [{ version: '0001', checksum: 'edited' }]
  const applied = new Map([['0001', { checksum: 'original' }]])
  const result = diffMigrations(migrations, applied)
  assert.deepEqual(result.pending, [])
  assert.deepEqual(result.mismatched, migrations)
})

test('diffMigrations: pending and mismatched and already-applied migrations can coexist', () => {
  const migrations = [
    { version: '0001', checksum: 'a' }, // applied, unchanged
    { version: '0002', checksum: 'edited' }, // applied, but edited since
    { version: '0003', checksum: 'c' }, // never applied
  ]
  const applied = new Map([
    ['0001', { checksum: 'a' }],
    ['0002', { checksum: 'original' }],
  ])
  const result = diffMigrations(migrations, applied)
  assert.deepEqual(result.pending, [migrations[2]])
  assert.deepEqual(result.mismatched, [migrations[1]])
})

test('diffMigrations: preserves input order and extra properties on migration objects', () => {
  const migrations = [
    { version: '0002', checksum: 'b', filename: '0002_b.sql' },
    { version: '0001', checksum: 'a', filename: '0001_a.sql' },
  ]
  const result = diffMigrations(migrations, new Map())
  assert.deepEqual(
    result.pending.map((m) => m.filename),
    ['0002_b.sql', '0001_a.sql'],
  )
})
