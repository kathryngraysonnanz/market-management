/**
 * Plain-SQL migration runner for Market Management. No ORM, no DSL — every migration is a
 * `.sql` file in `db/migrations/` applied verbatim, in order, inside its own transaction.
 *
 * Usage:
 *   node --env-file-if-exists=.dev.vars scripts/migrate.ts              # apply pending migrations
 *   node --env-file-if-exists=.dev.vars scripts/migrate.ts --dry-run    # report only, apply nothing
 *   node --env-file-if-exists=.dev.vars scripts/migrate.ts --status     # report applied/pending
 *
 * See db/README.md for the full contributor workflow.
 *
 * Requires `DATABASE_URL_DIRECT` (the Neon DIRECT endpoint, hostname without "-pooler").
 * This is deliberately a different variable from the Worker's pooled `DATABASE_URL`: the
 * pooled/HTTP transport cannot run interactive transactions or multi-statement files, so it
 * cannot execute a migration file verbatim. See src/worker/db.ts.
 *
 * This file is intentionally a thin I/O shell: argument parsing, endpoint classification,
 * filename validation and error-message extraction are pure functions in `migrate-lib.ts`,
 * unit-tested in `migrate-lib.test.ts` without a filesystem or database.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { Client } from '@neondatabase/serverless'
import {
  classifyEndpoint,
  describeError,
  diffMigrations,
  parseArgs,
  parseMigrationFilename,
  validateMigrationFilenames,
} from './migrate-lib.ts'

/** Serialises concurrent runs (e.g. two CI jobs at once) via a single global advisory lock. */
const ADVISORY_LOCK_KEY = 4021337

const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url)

interface Migration {
  version: string
  name: string
  filename: string
  contents: string
  checksum: string
}

interface AppliedRow {
  version: string
  name: string
  checksum: string
  applied_at?: string
}

function requireConnectionString(): string {
  const connectionString = process.env.DATABASE_URL_DIRECT
  if (!connectionString) {
    console.error(
      'DATABASE_URL_DIRECT is not set. See db/README.md — migrations use the Neon DIRECT endpoint, not the pooled DATABASE_URL.',
    )
    process.exit(1)
  }
  return connectionString
}

/** Guards against the pooled endpoint (AC-006) and never echoes the raw connection string. */
function assertDirectEndpoint(connectionString: string): string {
  const check = classifyEndpoint(connectionString)
  if (!check.ok) {
    if (check.reason === 'invalid-url') {
      console.error('DATABASE_URL_DIRECT is not a valid connection string')
    } else {
      console.error(
        `Refusing to run migrations over the pooled endpoint (${check.hostname}). Use the Neon direct endpoint (hostname without "-pooler").`,
      )
    }
    process.exit(1)
  }
  return check.hostname
}

async function discoverMigrations(): Promise<Migration[]> {
  const entries = await readdir(MIGRATIONS_DIR)
  const filenames = entries.filter((entry) => entry.endsWith('.sql')).sort()

  const { invalid, duplicates } = validateMigrationFilenames(filenames)

  if (invalid.length > 0) {
    console.error('Invalid migration filename(s) (expected NNNN_description.sql):')
    for (const filename of invalid) console.error(`  ${filename}`)
    process.exit(1)
  }

  if (duplicates.length > 0) {
    console.error('Duplicate migration version prefix(es):')
    for (const { version, files } of duplicates) {
      console.error(`  ${version}: ${files.join(', ')}`)
    }
    process.exit(1)
  }

  const migrations: Migration[] = []
  for (const filename of filenames) {
    const parsed = parseMigrationFilename(filename)
    // Unreachable: validated above, but keeps TypeScript's control-flow analysis honest.
    if (!parsed) continue
    const contents = await readFile(new URL(filename, MIGRATIONS_DIR), 'utf8')
    const checksum = createHash('sha256').update(contents).digest('hex')
    migrations.push({ version: parsed.version, name: parsed.name, filename, contents, checksum })
  }
  return migrations
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(`Unknown flag: ${parsed.unknownFlag}`)
    process.exit(1)
  }
  const { status: statusOnly, dryRun } = parsed.args

  const connectionString = requireConnectionString()
  const hostname = assertDirectEndpoint(connectionString)
  console.log(`target: ${hostname}`)

  const migrations = await discoverMigrations()

  const client = new Client(connectionString)
  try {
    await client.connect()
  } catch (error) {
    console.error(`Could not connect to ${hostname}: ${describeError(error)}`)
    process.exitCode = 1
    return
  }
  try {
    // Acquired before the ledger table even exists, so two runners starting at nearly the
    // same moment can't race on `create table if not exists` itself (that statement is not
    // fully concurrency-safe in Postgres) — the whole create-ledger/read/apply sequence is
    // serialized, not just the read/apply portion. Logged so a run that appears to hang is
    // self-explanatory rather than silent (it's waiting on another run, including a
    // concurrent `--status`/`--dry-run`, to release the lock).
    console.log('waiting for migration lock…')
    await client.query('select pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])
    try {
      await client.query(`
        create table if not exists schema_migrations (
          version       text        primary key,
          name          text        not null,
          checksum      text        not null,
          applied_at    timestamptz not null default now(),
          execution_ms  integer     not null
        )
      `)

      const { rows: appliedRows } = await client.query<AppliedRow>(
        'select version, name, checksum, applied_at from schema_migrations order by version',
      )
      const applied = new Map(appliedRows.map((row) => [row.version, row]))

      // Drift check: an applied migration that was edited after the fact is reported,
      // not silently ignored.
      const { pending, mismatched } = diffMigrations(migrations, applied)
      if (mismatched.length > 0) {
        for (const migration of mismatched) {
          console.error(
            `checksum mismatch for ${migration.filename}: it was already applied and has since been edited. Migrations are immutable — revert the edit or add a new migration.`,
          )
        }
        process.exitCode = 1
        return
      }

      if (statusOnly) {
        for (const migration of migrations) {
          const existing = applied.get(migration.version)
          if (existing) {
            console.log(`applied ${existing.version} ${existing.name} ${existing.applied_at}`)
          } else {
            console.log(`pending ${migration.version} ${migration.name}`)
          }
        }
        console.log(
          `summary: ${migrations.length - pending.length} applied, ${pending.length} pending`,
        )
        return
      }

      const skippedCount = migrations.length - pending.length

      if (dryRun) {
        for (const migration of pending) {
          console.log(`would-apply ${migration.filename}`)
        }
        console.log(
          `summary: ${skippedCount} already applied, ${pending.length} would apply (dry run — nothing was applied)`,
        )
        return
      }

      for (const migration of migrations) {
        const existing = applied.get(migration.version)
        if (existing) {
          console.log(`skip  ${migration.filename} (applied ${existing.applied_at})`)
        }
      }

      const appliedThisRun: string[] = []
      for (let i = 0; i < pending.length; i++) {
        const migration = pending[i]
        const start = performance.now()
        try {
          await client.query('begin')
          await client.query(migration.contents)
          // Measured once, right after the migration's own SQL finishes, and reused for both
          // the ledger row and the console log so the two never disagree. Deliberately
          // excludes the bookkeeping insert/commit that follows — it measures "how long this
          // migration's SQL took to run", not "total time to apply this file".
          const ms = Math.round(performance.now() - start)
          await client.query(
            'insert into schema_migrations (version, name, checksum, execution_ms) values ($1,$2,$3,$4)',
            [migration.version, migration.name, migration.checksum, ms],
          )
          await client.query('commit')
          console.log(`apply ${migration.filename} (${ms} ms)`)
          appliedThisRun.push(migration.filename)
        } catch (error) {
          try {
            await client.query('rollback')
          } catch {
            // A failed rollback must not mask the original error below.
          }
          const notAttempted = pending.slice(i + 1).map((m) => m.filename)
          console.error(
            `FAILED ${migration.filename} — rolled back, no partial changes from this file were kept.`,
          )
          console.error(
            `  applied this run: ${appliedThisRun.length > 0 ? appliedThisRun.join(', ') : 'none'}`,
          )
          console.error(`  failed:           ${migration.filename}`)
          console.error(
            `  not attempted:    ${notAttempted.length > 0 ? notAttempted.join(', ') : 'none'}`,
          )
          console.error(
            'Fix the SQL and re-run `npm run db:migrate`; previously applied migrations will be skipped.',
          )
          console.error(describeError(error))
          process.exitCode = 1
          return
        }
      }

      console.log(`done: ${appliedThisRun.length} applied, ${skippedCount} skipped, 0 failed`)
    } finally {
      try {
        await client.query('select pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY])
      } catch {
        // Best-effort: the connection is about to be closed regardless.
      }
    }
  } finally {
    await client.end()
  }
}

await main()
