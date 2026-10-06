# BMTM Cockpit

An app for farmer's market managers to see vital information in one place. Connects to
third-party apps via APIs to retrieve relevant data (weather, email, budget, and more) and
displays it in a single, user-friendly dashboard.

## Tech stack

| Concern         | Choice                                     |
| --------------- | ------------------------------------------ |
| Framework       | React 19                                   |
| Language        | TypeScript                                 |
| Build tool      | Vite                                       |
| UI components   | KendoReact (`@progress/kendo-react-*`)     |
| Theme           | `@progress/kendo-theme-meridian` (custom tokens in `src/styles/`) |
| Linting         | ESLint (flat config) + `typescript-eslint` |
| Formatting      | Prettier                                   |
| Package manager | npm                                        |

## Getting started

```bash
npm install
npx kendo-ui-license activate   # see "Telerik licensing" below
npm run dev
```

The app is served at <http://localhost:5173/>.

## Scripts

| Script                   | Description                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server with HMR on port 5173.                                               |
| `npm run build`          | Type-check with `tsc -b`, then produce a production bundle in `dist/`.                         |
| `npm run preview`        | Serve the contents of dist/ locally over plain HTTP (Vite — unrelated to Cloudflare previews). |
| `npm run typecheck`      | Type-check only, no bundle.                                                                    |
| `npm run lint`           | Run ESLint over the repository.                                                                |
| `npm run lint:fix`       | Run ESLint with `--fix`.                                                                       |
| `npm run format`         | Rewrite files with Prettier.                                                                   |
| `npm run format:check`   | Fail if any file is not Prettier-formatted.                                                    |
| `npm run cf:whoami`      | Show the authenticated Cloudflare account.                                                     |
| `npm run cf:dev`         | Run the Worker locally with Wrangler (serves `dist/`).                                         |
| `npm run deploy`         | Build, then deploy to the production Cloudflare Worker.                                        |
| `npm run deploy:preview` | Build, then upload a non-production version and print its preview URL.                         |

## Project structure

```
src/
├── components/   Application chrome composed from KendoReact
│   └── layout/   AppShell, AppHeader
├── features/     Domain slices; one directory per feature
│   └── dashboard/
├── pages/        Route-level compositions
├── lib/          Framework-agnostic helpers, types and constants
├── styles/       Kendo theme (index.scss + ThemeBuilder tokens, kendo-overrides.css)
├── assets/       Static assets imported by the bundler
├── App.tsx       Composes the shell with the current page
└── main.tsx      React entry point; imports the Kendo theme
```

**Dependency direction:** `pages → features → components → lib`. Imports must never flow
backwards — `lib/` imports nothing from the application, and `components/` never imports
from `features/` or `pages/`.

## UI components

This project uses **KendoReact** for all UI primitives. Do not hand-roll buttons, cards,
drawers, app bars, grids or chips, and do not add a second React component library.

- Browse the catalogue: <https://www.telerik.com/kendo-react-ui/components>
- Free vs premium: <https://www.telerik.com/kendo-react-ui/components/getting-started/free-vs-premium>

All `@progress/kendo-react-*` packages **must be kept at the same version** — their peer
dependencies on one another are exact-pinned, so upgrade them together.

Components currently in use (all free tier): `AppBar`, `Drawer`, `Card`, `GridLayout`,
`Button`, `Chip`, `Typography`.

### Theming

`src/main.tsx` imports stylesheets in a significant order:

1. `src/styles/index.scss` — the Kendo theme, built with `@progress/kendo-theme-meridian`
   and this project's custom palette/spacing/radius tokens (`src/styles/_tokens.scss`,
   generated via Progress ThemeBuilder).
2. `src/index.css` — this project's non-Kendo design tokens (used outside Kendo
   components).
3. `src/styles/kendo-overrides.css` — small layout fixes that aren't theme concerns
   (e.g. the drawer filling the viewport).

Change the palette, spacing or radii by editing `src/styles/_tokens.scss` (ideally by
re-exporting from Progress ThemeBuilder); component-level tweaks live in
`src/styles/_overrides.scss`. Do not edit the `@progress/kendo-theme-meridian` package.

## Telerik licensing

KendoReact requires a license key to remove the trial banner and to use premium components.

- The key lives in `telerik-license.txt` at the repository root (git-ignored), or in the
  `KENDO_UI_LICENSE` environment variable.
- `.npmrc` sets `ignore-scripts=true`, so the `@progress/kendo-licensing` postinstall hook
  **does not run automatically**. Activate manually after every `npm install`:

  ```bash
  npx kendo-ui-license activate
  ```

- Never commit or print the contents of `telerik-license.txt`.

## Path aliases

Declared in both `vite.config.ts` (`resolve.alias`) and `tsconfig.app.json`
(`compilerOptions.paths`). **Both files must be updated together** when an alias changes.

| Alias           | Resolves to        |
| --------------- | ------------------ |
| `@components/*` | `src/components/*` |
| `@features/*`   | `src/features/*`   |
| `@lib/*`        | `src/lib/*`        |
| `@pages/*`      | `src/pages/*`      |
| `@/*`           | `src/*`            |

## Environment variables

There are three distinct configuration planes. Putting a value in the wrong one either breaks the
build or leaks a secret — read the "Reaches the browser?" column before adding anything.

| Plane                          | Local source | Production source                          | Reaches the browser? |
| ------------------------------ | ------------ | ------------------------------------------ | -------------------- |
| **Vite build-time** (`VITE_*`) | `.env.local` | `vars.*` in `.github/workflows/deploy.yml` | **Yes — inlined**    |
| **Build-process secrets**      | shell env    | GitHub Actions repository secrets          | No                   |
| **Worker runtime secrets**     | `.dev.vars`  | `npx wrangler secret put <NAME>`           | No                   |

> **`VITE_*` values are not secret.** Vite substitutes them into the JavaScript bundle at build
> time, so anyone can read them in devtools. Never put an API key in a `VITE_*` variable — use a
> Worker runtime secret and a server-side route instead.

### Build-time variables

Copy `.env.example` to `.env.local` and edit. Adding a new variable means updating **all four** of:
`.env.example`, `src/vite-env.d.ts`, `src/lib/env.ts`, and the table below.

| Variable        | Default        | Purpose                                       |
| --------------- | -------------- | --------------------------------------------- |
| `VITE_APP_NAME` | `BMTM Cockpit` | Product name shown in the application header. |

### Worker runtime secrets

None yet — there is no Worker script (`wrangler.jsonc` has no `main` field). `.dev.vars.example`
documents the pattern to use when third-party integrations land.

### Local vs production

| Concern         | Local (`npm run dev`)                                      | Production (Cloudflare)                                |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Server          | Vite dev server, port 5173, HMR                            | Cloudflare edge, static assets from `dist/`            |
| Build-time vars | `.env.local`                                               | `vars.*` in the deploy workflow                        |
| SPA deep links  | Handled by the Vite dev server                             | `assets.not_found_handling: "single-page-application"` |
| Cache headers   | Not applied                                                | `public/_headers`                                      |
| Kendo licence   | `npx kendo-ui-license activate` from `telerik-license.txt` | `KENDO_UI_LICENSE` repository secret                   |
| Secrets         | `.dev.vars` (git-ignored)                                  | `npx wrangler secret put` / dashboard                  |

## Deployment

The app is hosted on **Cloudflare Workers Static Assets**. Configuration lives in
`wrangler.jsonc`; `assets.not_found_handling` is set to `single-page-application` so client-side
deep links resolve to `index.html` with HTTP 200.

| Trigger                | Workflow step                                     | Result                                                   |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Push to `main`         | `wrangler deploy`                                 | Promoted to the production URL                           |
| Pull request to `main` | `wrangler versions upload --preview-alias pr-<n>` | Preview URL posted as a PR comment; production untouched |
| Manual re-run          | `workflow_dispatch`                               | Same as a push to `main`                                 |

The pipeline is `.github/workflows/deploy.yml`. It installs from the private registry, activates
the KendoReact licence (required because `.npmrc` sets `ignore-scripts=true`), lints,
type-checks, builds, then deploys.

### Deploying by hand

```bash
npx wrangler login     # once per machine
npm run deploy         # build + wrangler deploy  (production)
npm run deploy:preview # build + wrangler versions upload (non-production)
```

### Cache and security headers

`public/_headers` is copied verbatim into `dist/` by Vite and read by Cloudflare. It marks
`/assets/*` immutable (safe — Vite content-hashes those filenames), forces `no-cache` on
`/index.html`, and sets baseline security headers. Cloudflare's default for every asset is
`max-age=0, must-revalidate`, so immutable caching must be declared explicitly.

> Setting up a brand-new instance for a different market? See **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**.

## Dependency policy

`.npmrc` pins this repository to a private registry, sets `ignore-scripts=true` and enforces
`min-release-age=7`. New dependencies must have been **published** more than 7 days ago —
check the version's own entry in `npm view <pkg> time --json`, not `time.modified`, which
reports unrelated metadata changes. Pin exact versions with `npm install --save-exact`.
