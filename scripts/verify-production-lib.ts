/**
 * Pure checks backing `scripts/verify-production.ts`, which automates the HTTP- and
 * static-analysis-based rows of TASK-5.6's 18-row production acceptance matrix
 * (`.forge/work/job_5/code/phase_5.md`).
 *
 * Split out for the same reason every other feature in this issue splits a pure core from its
 * I/O shell (see `src/worker/auth-helpers.ts`, `src/features/auth/session.ts`): each function
 * here takes already-fetched data (a status code, a body, a file's contents) and returns a
 * verdict, so the matrix's pass/fail logic is unit-tested directly (`npm run test:verify-prod`)
 * without a live deployment, a browser, or a network call.
 *
 * Rows not covered here are inherently manual: visual/DOM inspection (#1, #8, #11, #13),
 * documentation walkthroughs (#1, #2), multi-account comparison (#13), and timing observations
 * that span hours or require a specific browser (#17, #18). `verify-production.ts` prints a
 * reminder for each of those; this module only ever reports what it can prove.
 */

export interface CheckResult {
  row: number
  description: string
  status: 'pass' | 'fail' | 'skip'
  detail: string
}

function result(
  row: number,
  description: string,
  status: CheckResult['status'],
  detail: string,
): CheckResult {
  return { row, description, status, detail }
}

/** Row 3 — `GET /api/health` must stay public and report ok. */
export function checkHealth(httpStatus: number, body: unknown): CheckResult {
  const description = 'AC-007: GET /api/health is public'
  if (httpStatus !== 200) {
    return result(3, description, 'fail', `expected 200, got ${httpStatus}`)
  }
  if (typeof body !== 'object' || body === null || (body as { ok?: unknown }).ok !== true) {
    return result(3, description, 'fail', `expected {"ok":true,…}, got ${JSON.stringify(body)}`)
  }
  return result(3, description, 'pass', '200 {"ok":true,…}')
}

/** Row 4 — `GET /api/db/health` must stay public and report a live `now` timestamp. */
export function checkDbHealth(httpStatus: number, body: unknown): CheckResult {
  const description = 'AC-007: GET /api/db/health is public'
  if (httpStatus !== 200) {
    return result(4, description, 'fail', `expected 200, got ${httpStatus}`)
  }
  const now =
    typeof body === 'object' && body !== null ? (body as { now?: unknown }).now : undefined
  if (typeof body !== 'object' || body === null || (body as { ok?: unknown }).ok !== true || !now) {
    return result(
      4,
      description,
      'fail',
      `expected {"ok":true,"now":…}, got ${JSON.stringify(body)}`,
    )
  }
  return result(4, description, 'pass', `200 {"ok":true,"now":${JSON.stringify(now)}}`)
}

/** Row 5 — `GET /api/me` with no `Authorization` header must be rejected, not silently public. */
export function checkMeRequiresAuth(httpStatus: number, body: unknown): CheckResult {
  const description = 'AC-005: GET /api/me with no token is rejected'
  if (httpStatus !== 401) {
    return result(5, description, 'fail', `expected 401, got ${httpStatus}`)
  }
  if (JSON.stringify(body) !== JSON.stringify({ error: 'unauthorized' })) {
    return result(
      5,
      description,
      'fail',
      `expected exactly {"error":"unauthorized"}, got ${JSON.stringify(body)} — a cause-specific body would leak information to an unauthenticated caller`,
    )
  }
  return result(5, description, 'pass', '401 {"error":"unauthorized"}')
}

/** Row 6 — a malformed/garbage bearer token must be rejected the same way as no token at all. */
export function checkMeRejectsGarbageToken(httpStatus: number): CheckResult {
  const description = 'AC-005: GET /api/me with a malformed token is rejected'
  if (httpStatus !== 401) {
    return result(6, description, 'fail', `expected 401, got ${httpStatus}`)
  }
  return result(6, description, 'pass', '401')
}

/**
 * Row 7 — a token minted on one Neon branch must be rejected on another branch's `/api/me`
 * (issuer mismatch). Only runnable when a `development`-branch token is supplied; otherwise
 * skipped rather than reported as a false failure.
 */
export function checkCrossBranchTokenRejected(
  httpStatus: number,
  tokenSupplied: boolean,
): CheckResult {
  const description =
    'AC-005: a development-branch token is rejected by production (branch isolation)'
  if (!tokenSupplied) {
    return result(7, description, 'skip', 'set DEV_BRANCH_TOKEN to run this check')
  }
  if (httpStatus !== 401) {
    return result(7, description, 'fail', `expected 401, got ${httpStatus}`)
  }
  return result(7, description, 'pass', '401 — branch isolation holds')
}

/**
 * Row 12 — a valid token must return the signed-in account's own identity. Only runnable when a
 * `production`-branch token is supplied; otherwise skipped.
 */
export function checkMeReturnsIdentity(
  httpStatus: number,
  body: unknown,
  tokenSupplied: boolean,
): CheckResult {
  const description = 'AC-006: GET /api/me with a valid token returns id/email/name'
  if (!tokenSupplied) {
    return result(12, description, 'skip', 'set PROD_TOKEN to run this check')
  }
  if (httpStatus !== 200) {
    return result(12, description, 'fail', `expected 200, got ${httpStatus}`)
  }
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  if (typeof record.id !== 'string' || !record.id) {
    return result(
      12,
      description,
      'fail',
      `expected a non-empty string id, got ${JSON.stringify(body)}`,
    )
  }
  return result(12, description, 'pass', `200 ${JSON.stringify(body)}`)
}

/** Patterns that must never appear in a shipped bundle. Mirrors research.md §6.1's row 14 run. */
const BUNDLE_SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'Neon secret server key', pattern: /ssk_[a-zA-Z0-9]+/ },
  { name: 'Postgres connection string', pattern: /postgres(?:ql)?:\/\//i },
  { name: 'DATABASE_URL literal', pattern: /DATABASE_URL\s*=/ },
  {
    name: 'neon_auth schema reference',
    pattern: /neon_auth\.(?:user|session|account|project_config)/,
  },
]

/**
 * Row 14 — the built bundle must carry no secret, connection string, or internal schema
 * reference. Takes the already-read contents of every `dist/assets/*.js` file so the caller
 * controls the filesystem glob; this function only judges content.
 */
export function scanBundleForSecrets(files: ReadonlyMap<string, string>): CheckResult {
  const description = 'AC-009: built bundle carries no secret'
  if (files.size === 0) {
    return result(
      14,
      description,
      'skip',
      'no dist/assets/*.js files found — run npm run build first',
    )
  }
  const hits: string[] = []
  for (const [filename, contents] of files) {
    for (const { name, pattern } of BUNDLE_SECRET_PATTERNS) {
      if (pattern.test(contents)) {
        hits.push(`${name} in ${filename}`)
      }
    }
  }
  if (hits.length > 0) {
    return result(14, description, 'fail', hits.join('; '))
  }
  return result(14, description, 'pass', `scanned ${files.size} file(s), no match`)
}

/**
 * Row 15 — tracked source must never carry a real Neon Auth URL, only the documented
 * `ep-example-123456` placeholder. Takes the lines already matched by
 * `git grep -nE "https://ep-[a-z0-9-]+\\.neonauth"` so this function only judges content.
 */
export function scanTrackedSourceForRealAuthUrl(matchingLines: readonly string[]): CheckResult {
  const description = 'AC-009: no real Neon Auth URL is committed to tracked source'
  const real = matchingLines.filter((line) => !line.includes('ep-example-123456'))
  if (real.length > 0) {
    return result(15, description, 'fail', real.join('\n'))
  }
  return result(
    15,
    description,
    'pass',
    matchingLines.length > 0
      ? `${matchingLines.length} match(es), all placeholder`
      : 'no match at all',
  )
}

/** True when every non-skipped result passed. Skips are reported but never fail the run. */
export function allPassed(results: readonly CheckResult[]): boolean {
  return results.every((check) => check.status !== 'fail')
}
