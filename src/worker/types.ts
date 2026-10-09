/**
 * Server-side environment for this Worker.
 *
 * `Env` is generated into `worker-configuration.d.ts` by `npm run cf:types` from the
 * bindings declared in `wrangler.jsonc`. Secrets are not declared there, so
 * `DATABASE_URL` is added here.
 *
 * Every value on this interface is server-side only and must never be returned in a
 * response body, logged in full, or imported by anything under `src/` outside this
 * directory.
 */
export interface WorkerEnv extends Env {
  /**
   * Neon POOLED connection string for the current environment.
   *
   * Local: read from the git-ignored `.dev.vars`, pointing at the `development` branch.
   * Production: a Worker secret set with `npx wrangler secret put DATABASE_URL`,
   * pointing at the `production` branch.
   *
   * Use the pooled (`-pooler`) endpoint. Schema migrations use the **direct** endpoint via
   * `DATABASE_URL_DIRECT`, which is intentionally absent from this interface: migrations run in
   * Node (`npm run db:migrate`), never in the Worker, so the Worker has no way to run DDL.
   * See `db/README.md`.
   */
  DATABASE_URL: string

  /**
   * Base URL of this environment's Neon Auth (Managed Better Auth) instance, e.g.
   * `https://ep-example-123456.neonauth.REGION.aws.neon.tech/DATABASE/auth`.
   *
   * NOT a secret: the browser calls this host directly, and the JWKS keys published under it are
   * public by design. It is supplied through the same mechanism as `DATABASE_URL` only because it
   * is per-environment — the `development` and `production` Neon branches each provision their own
   * Auth instance with its own URL and its own signing keys, and `wrangler.jsonc` is a single
   * committed file that cannot vary per branch.
   *
   * Must hold the same value as the client's `VITE_NEON_AUTH_URL` for the same environment.
   *
   * Local: read from the git-ignored `.dev.vars`, pointing at the `development` branch.
   * Production: `npx wrangler secret put NEON_AUTH_BASE_URL`, pointing at the `production` branch.
   */
  NEON_AUTH_BASE_URL: string
}
