/**
 * Automates the HTTP- and static-analysis-based rows of TASK-5.6's 18-row production acceptance
 * matrix (`.forge/work/job_5/code/phase_5.md`), so running it after a real deployment is one
 * command instead of transcribing curl invocations by hand.
 *
 * Usage:
 *   CF_URL=https://your-worker.example.workers.dev node scripts/verify-production.ts
 *
 * Optional, to also run the two token-gated rows:
 *   PROD_TOKEN=<a valid production JWT>        node scripts/verify-production.ts   # row 12
 *   DEV_BRANCH_TOKEN=<a valid development JWT> node scripts/verify-production.ts   # row 7
 *
 * This script only ever runs the rows that are expressible as an HTTP request or a filesystem/
 * git scan (3, 4, 5, 6, 7, 12, 14, 15). The remaining rows are inherently manual — a documented
 * walkthrough, a DOM/visual inspection, a side-by-side account comparison, or an hours-long/
 * browser-specific observation — and are printed as reminders, never silently skipped.
 *
 * All verdict logic lives in `verify-production-lib.ts` as pure functions, unit-tested in
 * `verify-production-lib.test.ts` without a live deployment; this file only performs I/O and
 * prints the result.
 */
import { readdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
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
import type { CheckResult } from './verify-production-lib.ts'

const execFileAsync = promisify(execFile)

const MANUAL_ROWS = [
  '1  (AC-008) Follow docs/DEPLOYMENT.md end to end on a clean machine',
  '2  (AC-010) Follow Step 3c\u2019s first-admin bootstrap',
  '8  (AC-001) View Source while signed out — sign-in card only, no dashboard markup',
  '9  (AC-002) Sign in, hard-reload — dashboard persists, no re-prompt',
  '10 (AC-003) Submit wrong credentials — clear error, no protected content',
  '11 (AC-004) Sign out, press Back, navigate to /budget — sign-in card every time',
  '13 (AC-006a) Two admin accounts side by side — identical content',
  '16 (\u2014) Inspect Worker logs after the 401 tests above — no token/JWT fragment logged',
  '17 (U4) Leave a signed-in tab closed 24h, reopen — record session persistence',
  '18 (U7) Repeat row 9 in Safari — record whether the session survives a reload',
]

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

async function readDistAssets(): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  let entries: string[]
  try {
    entries = await readdir(new URL('../dist/assets/', import.meta.url))
  } catch {
    return files
  }
  for (const entry of entries.filter((name) => name.endsWith('.js'))) {
    const contents = await readFile(new URL(`../dist/assets/${entry}`, import.meta.url), 'utf8')
    files.set(entry, contents)
  }
  return files
}

async function gitGrepAuthUrls(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', [
      'grep',
      '-nE',
      String.raw`https://ep-[a-z0-9-]+\.neonauth`,
    ])
    return stdout.split('\n').filter((line) => line.length > 0)
  } catch (error) {
    // `git grep` exits 1 (not an error here) when there are zero matches.
    if ((error as { code?: number }).code === 1) {
      return []
    }
    throw error
  }
}

function printResult(check: CheckResult): void {
  const icon = check.status === 'pass' ? '✅' : check.status === 'skip' ? '⏭️ ' : '❌'
  console.log(`${icon} #${check.row} ${check.description} — ${check.detail}`)
}

async function main(): Promise<void> {
  const cfUrl = process.env.CF_URL
  if (!cfUrl) {
    console.error('CF_URL is not set. Example: CF_URL=https://your-worker.example.workers.dev')
    process.exit(1)
  }
  const base = cfUrl.replace(/\/+$/, '')

  const results: CheckResult[] = []

  const health = await fetchJson(`${base}/api/health`)
  results.push(checkHealth(health.status, health.body))

  const dbHealth = await fetchJson(`${base}/api/db/health`)
  results.push(checkDbHealth(dbHealth.status, dbHealth.body))

  const meNoAuth = await fetchJson(`${base}/api/me`)
  results.push(checkMeRequiresAuth(meNoAuth.status, meNoAuth.body))

  const meGarbage = await fetchJson(`${base}/api/me`, {
    headers: { authorization: 'Bearer not-a-real-token' },
  })
  results.push(checkMeRejectsGarbageToken(meGarbage.status))

  const devToken = process.env.DEV_BRANCH_TOKEN
  if (devToken) {
    const crossBranch = await fetchJson(`${base}/api/me`, {
      headers: { authorization: `Bearer ${devToken}` },
    })
    results.push(checkCrossBranchTokenRejected(crossBranch.status, true))
  } else {
    results.push(checkCrossBranchTokenRejected(0, false))
  }

  const prodToken = process.env.PROD_TOKEN
  if (prodToken) {
    const meAuthed = await fetchJson(`${base}/api/me`, {
      headers: { authorization: `Bearer ${prodToken}` },
    })
    results.push(checkMeReturnsIdentity(meAuthed.status, meAuthed.body, true))
  } else {
    results.push(checkMeReturnsIdentity(0, null, false))
  }

  const bundleFiles = await readDistAssets()
  results.push(scanBundleForSecrets(bundleFiles))

  const authUrlMatches = await gitGrepAuthUrls()
  results.push(scanTrackedSourceForRealAuthUrl(authUrlMatches))

  console.log(`\nAutomated TASK-5.6 rows (target: ${base})\n`)
  for (const check of results) {
    printResult(check)
  }

  console.log('\nManual rows — not automatable, run and record by hand:\n')
  for (const row of MANUAL_ROWS) {
    console.log(`\u2022 ${row}`)
  }

  if (!allPassed(results)) {
    console.error('\nOne or more automated rows failed.')
    process.exit(1)
  }
  console.log('\nAll automated rows passed (see above for any skipped rows).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
