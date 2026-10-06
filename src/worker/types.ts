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
   * Use the pooled (`-pooler`) endpoint. Schema migrations, which are out of scope for
   * this issue, require the direct endpoint instead.
   */
  DATABASE_URL: string
}
