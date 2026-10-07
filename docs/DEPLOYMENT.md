# Deploying your own instance

Market Management is open source. Any farmers' market can run its own independent copy: each instance
is a separate Cloudflare Worker with its own data, its own domain, and its own configuration. This
guide walks a new operator through standing up a brand-new instance from a fork.

## Prerequisites

- A GitHub account and a fork of `kathryngraysonnanz/market-management`.
- A Cloudflare account (the Free plan is sufficient: 100,000 Worker requests/day).
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

| Secret                  | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token created from the **"Edit Cloudflare Workers"** template, scoped to the target account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (dashboard sidebar, or `npx wrangler whoami`)                                        |
| `NPM_TOKEN`             | Read token for the Harness private registry in `.npmrc`                                                    |
| `KENDO_UI_LICENSE`      | Full contents of `telerik-license.txt`                                                                     |

Create at **Settings → Secrets and variables → Actions → Variables**:

| Variable        | Value          |
| --------------- | -------------- |
| `VITE_APP_NAME` | `Market Management` |

Using the `gh` CLI:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set NPM_TOKEN
gh secret set KENDO_UI_LICENSE < telerik-license.txt
gh variable set VITE_APP_NAME --body "Your Market Name"
```

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

## Troubleshooting

| Symptom                                   | Cause                                              | Fix                                                                       |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| Trial watermark on KendoReact components  | Licence activation skipped (`ignore-scripts=true`) | Ensure `npx kendo-ui-license activate` runs before `npm run build`        |
| Deep link returns 404                     | `not_found_handling` missing or misspelled         | Set `"not_found_handling": "single-page-application"` in `wrangler.jsonc` |
| `npm ci` 401/403 in CI                    | `NPM_TOKEN` missing or registry URL mismatch       | Verify the `_authToken` key path matches `registry=` exactly              |
| `wrangler deploy` fails on Worker name    | Dashboard name ≠ `wrangler.jsonc` `name`           | Rename one to match the other                                             |
| Stale UI after a deploy                   | `index.html` cached                                | Confirm `public/_headers` has `/index.html` → `Cache-Control: no-cache`   |
| `binding is only valid with main` warning | `assets.binding` set without a `main` script       | Remove `binding` until a Worker script exists                             |

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
