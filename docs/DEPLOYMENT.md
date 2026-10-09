# Deploying your own instance

Market Management is open source. Any farmers' market can run its own independent copy: each instance
is a separate Cloudflare Worker with its own data, its own domain, and its own configuration. This
guide walks a new operator through standing up a brand-new instance from a fork.

## Prerequisites

- A GitHub account and a fork of `kathryngraysonnanz/market-management`.
- A Cloudflare account (the Free plan is sufficient: 100,000 Worker requests/day).
- A Neon account and a PostgreSQL project (the free plan is sufficient), with `development`
  and `production` branches.
- Node.js 24 (matching `.nvmrc`).
- **A KendoReact licence of your own.** The licence used by this repository is **not
  transferable**; obtain a free or commercial KendoReact licence from Telerik and use your own
  key.
- Access to an npm registry. `.npmrc` pins a private Harness registry belonging to the upstream
  project; a fork without access must replace the `registry=` line with
  `https://registry.npmjs.org/` and remove the `@jsr:registry` line, keeping
  `ignore-scripts=true` and `min-release-age=7`.

## Step 1 — Fork and configure

```bash
gh repo fork kathryngraysonnanz/market-management --clone
cd market-management
```

Edit `wrangler.jsonc` and change `"name"` from `market-management` to your own worker name
(lowercase alphanumerics and hyphens; it becomes part of your URL). Change `VITE_APP_NAME` to
your market's name.

## Step 2 — Create a Cloudflare API token

In the Cloudflare dashboard: _My Profile → API Tokens → Create Token_, choose the
**"Edit Cloudflare Workers"** template, and scope it to your account. Copy the token once — it is
shown only at creation time. Get your account ID from the dashboard sidebar or by running
`npx wrangler whoami`.

## Step 3 — Add repository secrets

Create at **Settings → Secrets and variables → Actions → Secrets**:

| Secret                  | Value                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token created from the **"Edit Cloudflare Workers"** template, scoped to the target account                                                                                                                  |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (dashboard sidebar, or `npx wrangler whoami`)                                                                                                                                                         |
| `NPM_TOKEN`             | Read token for the Harness private registry in `.npmrc`                                                                                                                                                                     |
| `KENDO_UI_LICENSE`      | Full contents of `telerik-license.txt`                                                                                                                                                                                      |
| `DATABASE_URL_DIRECT`   | Neon **direct** connection string (hostname **without** `-pooler`) for the `production` branch. Used only by the migration step. **Required** — without it the migration step is skipped and the database is never created. |
| `DATABASE_URL`          | Neon **pooled** connection string for the `production` branch. Set as a _Worker_ secret (`npx wrangler secret put DATABASE_URL`), **not** a GitHub secret.                                                                  |
| `NEON_AUTH_BASE_URL`    | Neon Auth base URL for the `production` branch. Set as a _Worker_ secret (`npx wrangler secret put NEON_AUTH_BASE_URL`), **not** a GitHub secret. Not actually secret — the browser calls this host — but per-environment.  |

Create at **Settings → Secrets and variables → Actions → Variables**:

| Variable                       | Value                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_NAME`                | `Market Management`                                                                                                                                                                                                                                                                                                                                                                                                     |
| `VITE_NEON_AUTH_URL`           | Neon Auth base URL for the `production` branch — the same value as the `NEON_AUTH_BASE_URL` Worker secret. **Required**: the deploy workflow fails if it is unset, because a build without it produces an application nobody can sign in to.                                                                                                                                                                            |
| `DATABASE_MIGRATIONS_REQUIRED` | `true` — **set this only after Step 3b's first manual migration run has succeeded.** Once set, the deploy workflow hard-fails instead of silently skipping if `DATABASE_URL_DIRECT` is ever missing (e.g. a secret accidentally deleted or not copied over during a credential rotation). Leave unset on a fresh fork that has not run Step 3b yet, so the first few deploys can succeed without a database configured. |

Using the `gh` CLI:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set NPM_TOKEN
gh secret set KENDO_UI_LICENSE < telerik-license.txt
gh secret set DATABASE_URL_DIRECT
gh variable set VITE_APP_NAME --body "Your Market Name"
gh variable set VITE_NEON_AUTH_URL --body "https://ep-….neonauth.REGION.aws.neon.tech/DATABASE/auth"
```

## Step 3c — Enable Neon Auth

This project uses **Neon Auth (Managed Better Auth)**. Identity lives in your own Neon database
in the `neon_auth` schema, so each database branch gets its own isolated set of users, its own
Auth URL, and its own signing keys. Tokens issued on one branch are rejected on another — local
development can never authenticate against production users.

Install the Neon CLI and sign in:

```bash
npm i -g neonctl
neon auth
```

Enable Auth on both branches and note the base URL each one prints:

```bash
neon neon-auth enable --branch development
neon neon-auth status --branch development     # note the development base URL

neon neon-auth enable --branch production
neon neon-auth status --branch production      # note the production base URL
```

Allow local development origins on the development branch only:

```bash
neon neon-auth domain allow-localhost enable  --branch development
neon neon-auth domain allow-localhost disable --branch production
```

Register your production origin as a trusted domain. A trusted domain is an **origin**: include
the protocol and omit any trailing slash.

```bash
neon neon-auth domain add https://market-management.<your-subdomain>.workers.dev --branch production
```

Configure both environments:

| Where                   | Name                 | Value                |
| ----------------------- | -------------------- | -------------------- |
| `.env.local`            | `VITE_NEON_AUTH_URL` | development base URL |
| `.dev.vars`             | `NEON_AUTH_BASE_URL` | development base URL |
| GitHub Actions variable | `VITE_NEON_AUTH_URL` | production base URL  |
| Worker secret           | `NEON_AUTH_BASE_URL` | production base URL  |

```bash
npx wrangler secret put NEON_AUTH_BASE_URL
```

### Create the first admin account

Every account that can sign in is a full administrator of this dashboard. There are no other
roles. Neon Auth allows open sign-up by default, so on a live deployment that would be an open
admin registration form. **Do these steps in this exact order.**

1. Deploy (Step 4), then open your deployed URL **before announcing it to anyone**.
2. Register the first admin account:

   ```bash
   neon neon-auth user create --email you@example.com --name "Your Name" --branch production
   ```

   Then use the password-reset link on the sign-in page to set a password, or sign up once
   through the app if sign-up is still enabled.

3. **Immediately** close sign-up:

   ```bash
   neon neon-auth config email-password update --disable-sign-up --branch production
   ```

4. **Verify it is closed.** This is the control that keeps strangers out of your dashboard — do
   not skip it:

   ```bash
   neon neon-auth config email-password get --branch production
   ```

To add another market manager later:

```bash
neon neon-auth user create --email colleague@example.com --name "Their Name" --branch production
```

They set their own password through the password-reset flow on the sign-in page.

### Recommended hardening

Neon's shared mail sender (`auth@mail.myneon.app`) is rate-limited and supports verification
**codes** only. For a production market, configure your own SMTP provider and require email
verification:

```bash
neon neon-auth config email-provider update --type standard \
  --host smtp.example.com --port 587 --username <user> --password <pass> \
  --sender-email noreply@example.com --sender-name "Your Market" --branch production
neon neon-auth config email-password update --require-email-verification --branch production
```

See <https://neon.com/docs/auth/production-checklist>.

## Step 3b — Create the database schema

Before the first deploy, apply the baseline migration once, by hand, against the
`production` branch's **direct** endpoint:

```bash
# One-off, from your clone, pointing at the production branch's DIRECT endpoint:
DATABASE_URL_DIRECT="postgresql://…@ep-….REGION.aws.neon.tech/DATABASE?sslmode=require" \
  node scripts/migrate.ts
```

After this first run, every later push to `main` applies any new migrations automatically via
the "Apply database migrations" step in `.github/workflows/deploy.yml` (before `wrangler
deploy`, so new code never meets an old schema). That step is skipped — not failed — if
`DATABASE_URL_DIRECT` is not configured as a repository secret, so a fork that has not set up
a database yet still deploys successfully. Once this first run has succeeded, set the
`DATABASE_MIGRATIONS_REQUIRED` repository variable to `true` (above) so that a _later_,
unexpected loss of the secret hard-fails the deploy instead of silently skipping migrations
forever after. See `db/README.md` for the full migration workflow.

## Step 4 — First deploy

```bash
npm ci
npx kendo-ui-license activate
npm run build
npx wrangler login
npx wrangler deploy
```

The first `wrangler deploy` creates the Worker and prints the live URL. Every later push to
`main` deploys automatically via `.github/workflows/deploy.yml`.

## Step 5 — Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$CF_URL/"             # expected: 200
curl -sS -o /dev/null -w '%{http_code}\n' "$CF_URL/markets/123"  # expected: 200 (SPA fallback)
curl -sSI "$CF_URL/assets/<hashed-file>" | grep -i cache-control # expected: immutable
curl -sS "$CF_URL/api/db/health"                                 # expected: {"ok":true,…}
curl -sS -o /dev/null -w '%{http_code}\n' "$CF_URL/api/health"    # expected: 200 (public)
curl -sS -o /dev/null -w '%{http_code}\n' "$CF_URL/api/me"        # expected: 401 (protected)
```

## Alternative: Cloudflare Workers Builds

An operator who prefers not to use GitHub Actions can instead connect the repository directly in
the Cloudflare dashboard (_Workers & Pages → Create → Import a repository_). Configure:

- Build command: `npm ci && npx kendo-ui-license activate && npm run build`
- Deploy command: `npx wrangler deploy`
- Build variable `SKIP_DEPENDENCY_INSTALL=1` (because the automatic install would skip the
  licence activation step that `ignore-scripts=true` suppresses)
- Build variables/secrets: `NPM_TOKEN`, `KENDO_UI_LICENSE`, `VITE_APP_NAME`
- A warning: the dashboard Worker name must exactly match `name` in `wrangler.jsonc` or the build
  fails.
- Free-plan build limits: 3,000 build-minutes/month, 1 concurrent build, 20-minute timeout.
- This path has **no migration step**. After adding any migration, the operator must run
  `node scripts/migrate.ts` (with `DATABASE_URL_DIRECT` set) by hand against `production`.

## Troubleshooting

| Symptom                                              | Cause                                                                       | Fix                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Trial watermark on KendoReact components             | Licence activation skipped (`ignore-scripts=true`)                          | Ensure `npx kendo-ui-license activate` runs before `npm run build`                           |
| Deep link returns 404                                | `not_found_handling` missing or misspelled                                  | Set `"not_found_handling": "single-page-application"` in `wrangler.jsonc`                    |
| `npm ci` 401/403 in CI                               | `NPM_TOKEN` missing or registry URL mismatch                                | Verify the `_authToken` key path matches `registry=` exactly                                 |
| `wrangler deploy` fails on Worker name               | Dashboard name ≠ `wrangler.jsonc` `name`                                    | Rename one to match the other                                                                |
| Stale UI after a deploy                              | `index.html` cached                                                         | Confirm `public/_headers` has `/index.html` → `Cache-Control: no-cache`                      |
| `binding is only valid with main` warning            | `assets.binding` set without a `main` script                                | Remove `binding` until a Worker script exists                                                |
| Migration step skipped in CI                         | `DATABASE_URL_DIRECT` repository secret unset                               | Add it (Step 3) — the step runs only when the secret is present                              |
| Migration fails with a pooled-endpoint error         | The secret holds the `-pooler` hostname                                     | Use the Neon **direct** connection string instead (no `-pooler`)                             |
| Deploy fails on "Require database migrations secret" | `DATABASE_MIGRATIONS_REQUIRED` is `true` but `DATABASE_URL_DIRECT` is unset | Restore the secret, or unset the variable if migrations are intentionally no longer required |

## Limits to be aware of

Free plan: 100,000 Worker requests/day; 20,000 static asset files per version; 25 MiB per asset
file; 64 environment variables at 5 KB each. See
<https://developers.cloudflare.com/workers/platform/limits/>.

## Adding server-side API keys later

Third-party integration keys (weather, email, budget providers, etc.) must **never** be `VITE_*`
variables — that would ship them to every visitor's browser. When a real integration lands:

1. Add a `main` entry point (a Worker script) to `wrangler.jsonc`.
2. Set `run_worker_first: ["/api/*"]` so requests under `/api/*` reach the Worker script instead of
   being served as static assets.
3. Store the credential with `npx wrangler secret put <NAME>` (or in the dashboard) — never in a
   file, and never as a `VITE_*` variable.
4. Have the SPA call its own `/api/*` route, and have the Worker script attach the secret
   server-side before calling the third-party API.

## Known gaps

- Custom domain / `routes` configuration (ASM-03, OQ-01).
- `Content-Security-Policy` header — needs a KendoReact-compatible `style-src` policy
  (PHASE-3 TASK-302).
- A server-side API proxy Worker for third-party credentials (ASM-04, OQ-03).
- `@cloudflare/vite-plugin` adoption, pending Vite 8 compatibility confirmation (OQ-02).
- A signed-out or deleted user's already-issued access token stays valid until it expires, up to
  15 minutes. Token lifetime is fixed by Neon and is not configurable.
- Because the application and Neon Auth are on different origins, the session cookie is a
  third-party cookie. Safari's Intelligent Tracking Prevention may block it. If Safari users
  cannot stay signed in, see
  <https://www.better-auth.com/docs/concepts/cookies#safari-itp-and-cross-domain-setups>.
- Neon Auth has no invite flow. Additional admins are provisioned with `neon neon-auth user create`.
- **Confirmed 2026-10-08** against a live Neon Auth `development`-branch instance: once
  `email_and_password.disableSignUp` is `true`, `POST /auth/sign-up/email` is rejected with
  `400 EMAIL_PASSWORD_SIGN_UP_DISABLED` and creates no user row, while `POST /auth/sign-in/email`
  continues to work normally for existing accounts. The `--disable-sign-up` control is real and
  effective — see TASK-5.3 in `.forge/work/job_5/code/phase_5.md` for the verification transcript.
  This application also ships no sign-up UI regardless, so the flag is defence in depth, not the
  only control.
