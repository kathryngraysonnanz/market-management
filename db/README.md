# Database migrations

Plain SQL, version-controlled, repeatable. **No ORM.**

## Layout

```
db/
└── migrations/
    ├── 0001_init.sql
    └── NNNN_short-description.sql
```

Each file in `db/migrations/` is the **single source of truth** for the schema — there is
no separate `db/schema/` snapshot. A hand-maintained snapshot would drift from reality the
first time someone forgot to update it, and without an ORM nothing generates or consumes it.
If you need to know the current schema, read the migration files in order, or query the
database directly.

## Pooled vs direct

| Variable              | Endpoint | Used by                     | Worker secret? |
| ---------------------- | -------- | ---------------------------- | -------------- |
| `DATABASE_URL`          | Pooled (`-pooler` hostname) | The Worker at request time (`src/worker/db.ts`) | Yes — `WorkerEnv` |
| `DATABASE_URL_DIRECT`   | Direct (no `-pooler`)       | The migration runner, in Node/CI only (`scripts/migrate.ts`) | **No** |

Why two variables: the pooled endpoint is HTTP-only — one statement per round trip, no
interactive transactions (see the doc comment in `src/worker/db.ts`). It cannot execute a
migration file verbatim inside a `BEGIN`/`COMMIT` block. The direct endpoint supports a real
WebSocket connection with interactive transactions, which the runner needs for per-file
atomicity. `DATABASE_URL_DIRECT` is deliberately **not** part of `WorkerEnv` and must never be
set with `wrangler secret put` — the Worker has no legitimate reason to run DDL.

## Adding a migration

1. Pick the next free 4-digit number (look at the highest existing prefix in
   `db/migrations/` and add one).
2. Create `db/migrations/NNNN_short-description.sql`, lowercase with hyphens
   (`^\d{4}_[a-z0-9-]+\.sql$`).
3. Write plain SQL. Do **not** add `BEGIN`/`COMMIT` — the runner wraps the whole file in its
   own transaction.
4. Run `npm run db:migrate:dry` to confirm it is picked up, then `npm run db:migrate` against
   your Neon `development` branch to apply and verify it.
5. Commit the `.sql` file. That file, not any generated artefact, is the change you are
   reviewing and shipping.

## Immutability

Never edit a migration after it has been applied to any database. The runner stores a
SHA-256 checksum of every applied file's contents and refuses to run (on any database where
the migration is already recorded) if the checksum no longer matches. Fix a mistake with a
new, higher-numbered migration — never by rewriting history.

## Forward-only

There are no `down` migrations. This is intentional: a down-migration for a destructive
change (e.g. a dropped column) cannot restore lost data, so maintaining one is false
confidence. To undo a change, write a new forward migration that reverses it. Flag any
destructive statement (`drop table`, `alter table … drop column`, etc.) for extra scrutiny
in code review — it is irreversible once applied.

## Numbering collisions

If two branches each add `0007_*.sql` and both get merged, the second to land must rename its
file to the next free number (e.g. `0008_*.sql`) and re-run `npm run db:migrate` locally
before opening/updating the PR. The runner detects two files sharing the same 4-digit prefix
and fails immediately (`npm run db:status` or `npm run db:migrate`), so this is caught at CI
time rather than causing a silent ordering bug.

## Commands

| Command                   | Effect                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `npm run db:status`        | Prints `applied`/`pending` for every migration. Applies nothing. Exit 0 even with pending migrations. |
| `npm run db:migrate:dry`   | Prints which migrations *would* apply. Applies nothing.                 |
| `npm run db:migrate`       | Applies every pending migration, one transaction per file, in order.    |
| `npm run test:migrate`     | Runs the runner's unit tests (`scripts/migrate-lib.test.ts`, Node's built-in test runner). No database required. Enforced in CI. |

The first three read `DATABASE_URL_DIRECT` from the git-ignored `.dev.vars` locally (via
`--env-file-if-exists`) and from the environment in CI. All three also take the same advisory
lock as a real apply run (serialising against a concurrent run of any kind), so a `db:status`
check can briefly wait behind an in-progress `db:migrate` — this is intentional, so status
always reflects a consistent view, and is logged (`waiting for migration lock…`) rather than
silent.

## Testing the runner

`scripts/migrate.ts` is a thin I/O shell: argument parsing, pooled-vs-direct endpoint
classification, migration-filename validation, pending/applied/checksum-mismatch
reconciliation, and error-message extraction are pure functions in `scripts/migrate-lib.ts`,
unit-tested in `scripts/migrate-lib.test.ts` with Node's built-in `node:test` runner (no new
dependency, no database or filesystem access needed). Run them with `npm run test:migrate`.
The parts of the runner that actually talk to Postgres (the transaction/rollback sequencing
and the advisory lock around `begin`/`insert`/`commit`) are not covered by that suite — verify
those by hand against a disposable Neon branch using the commands above before trusting a
change to that part of the file.

## Troubleshooting

| Message                                                              | Cause                                              | Fix                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL_DIRECT is not set`                                        | The variable is missing from `.dev.vars` or the CI environment | Add it — see `.dev.vars.example` and `docs/DEPLOYMENT.md`               |
| `Refusing to run migrations over the pooled endpoint (<hostname>)`      | `DATABASE_URL_DIRECT` holds a `-pooler` connection string | Copy the **direct** connection string from the Neon console instead    |
| `checksum mismatch for <file>`                                          | An already-applied migration file was edited        | Revert the edit; add a new migration for the intended change instead   |
| `FAILED <file>` — rolled back; fix and re-run                          | The migration's SQL errored partway through         | Fix the SQL in that file, re-run `npm run db:migrate` — earlier migrations are skipped automatically |
| A run appears to hang after printing `waiting for migration lock…`     | Another run (including a concurrent `--status`/`--dry-run`) holds the advisory lock | Wait for the other run to finish (or fail); it will release the lock   |
