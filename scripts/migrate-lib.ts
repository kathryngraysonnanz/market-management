/**
 * Pure, dependency-free logic for `scripts/migrate.ts`, split out so it can be unit-tested
 * with `node:test` without a filesystem or a database connection. Nothing in this module
 * performs I/O, reads `process.env`, or calls `process.exit` — every function takes its
 * inputs as arguments and returns a plain value describing the outcome.
 */

/** Matches the required `NNNN_description.sql` migration filename shape (AC-004). */
export const MIGRATION_FILENAME_PATTERN = /^(\d{4})_[a-z0-9-]+\.sql$/

export interface ParsedArgs {
  status: boolean
  dryRun: boolean
}

export type ParseArgsResult = { ok: true; args: ParsedArgs } | { ok: false; unknownFlag: string }

/** Parses `--status` / `--dry-run`. Any other flag is reported, not thrown. */
export function parseArgs(argv: readonly string[]): ParseArgsResult {
  let status = false
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--status') {
      status = true
    } else if (arg === '--dry-run') {
      dryRun = true
    } else {
      return { ok: false, unknownFlag: arg }
    }
  }
  return { ok: true, args: { status, dryRun } }
}

export type EndpointCheck =
  | { ok: true; hostname: string }
  | { ok: false; reason: 'invalid-url' }
  | { ok: false; reason: 'pooled'; hostname: string }

/**
 * Guards against the pooled endpoint (AC-006). Never returns or logs anything derived from
 * the connection string beyond the hostname.
 */
export function classifyEndpoint(connectionString: string): EndpointCheck {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    return { ok: false, reason: 'invalid-url' }
  }
  if (url.hostname.includes('-pooler')) {
    return { ok: false, reason: 'pooled', hostname: url.hostname }
  }
  return { ok: true, hostname: url.hostname }
}

export interface ParsedFilename {
  version: string
  name: string
}

/** Splits a validated `NNNN_description.sql` filename into its version and name parts. */
export function parseMigrationFilename(filename: string): ParsedFilename | null {
  const match = MIGRATION_FILENAME_PATTERN.exec(filename)
  if (!match) return null
  const version = match[1]
  const name = filename.slice(version.length + 1, -'.sql'.length)
  return { version, name }
}

export interface FilenameValidation {
  invalid: string[]
  /** Each entry is a 4-digit version prefix shared by two or more files, with those files. */
  duplicates: Array<{ version: string; files: string[] }>
}

/**
 * Validates a list of `.sql` migration filenames (already filtered to end in `.sql`):
 * every name must match {@link MIGRATION_FILENAME_PATTERN}, and no two files may share the
 * same 4-digit version prefix (AC-004). Pure — takes filenames, not directory contents.
 */
export function validateMigrationFilenames(filenames: readonly string[]): FilenameValidation {
  const invalid: string[] = []
  const versionsSeen = new Map<string, string[]>()

  for (const filename of filenames) {
    const parsed = parseMigrationFilename(filename)
    if (!parsed) {
      invalid.push(filename)
      continue
    }
    const existing = versionsSeen.get(parsed.version) ?? []
    existing.push(filename)
    versionsSeen.set(parsed.version, existing)
  }

  const duplicates = [...versionsSeen.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files }))

  return { invalid, duplicates }
}

export interface MigrationDiff<M extends { version: string; checksum: string }> {
  /** Migrations with no matching row in `schema_migrations`, in original (sorted) order. */
  pending: M[]
  /**
   * Previously-applied migrations whose on-disk checksum no longer matches the ledger — an
   * edit to an already-applied file, which violates the immutability policy (see
   * `db/README.md`) and must be surfaced rather than silently re-applied or ignored.
   */
  mismatched: M[]
}

/**
 * Pure reconciliation between the migrations found on disk and the `schema_migrations`
 * ledger rows already applied. A migration is "pending" when no ledger row exists for its
 * version, and "mismatched" when a ledger row exists but its recorded checksum disagrees
 * with the current file contents. A migration cannot be both.
 */
export function diffMigrations<M extends { version: string; checksum: string }>(
  migrations: readonly M[],
  applied: ReadonlyMap<string, { checksum: string }>,
): MigrationDiff<M> {
  const pending: M[] = []
  const mismatched: M[] = []
  for (const migration of migrations) {
    const existing = applied.get(migration.version)
    if (existing === undefined) {
      pending.push(migration)
    } else if (existing.checksum !== migration.checksum) {
      mismatched.push(migration)
    }
  }
  return { pending, mismatched }
}

/**
 * Extracts a human-readable message from any thrown value. WebSocket connection failures
 * surface as an `ErrorEvent`-shaped object (not an `Error`) whose useful detail lives on its
 * `.error` property, so unwrap that case before falling back to `Error#message`/`String()`.
 */
export function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const inner = (error as { error: unknown }).error
    if (inner instanceof Error) return inner.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}
