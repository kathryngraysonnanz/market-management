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
| Theme           | `@progress/kendo-theme-default`            |
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

| Script                 | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server with HMR on port 5173.                       |
| `npm run build`        | Type-check with `tsc -b`, then produce a production bundle in `dist/`. |
| `npm run preview`      | Serve the contents of `dist/` locally.                                 |
| `npm run typecheck`    | Type-check only, no bundle.                                            |
| `npm run lint`         | Run ESLint over the repository.                                        |
| `npm run lint:fix`     | Run ESLint with `--fix`.                                               |
| `npm run format`       | Rewrite files with Prettier.                                           |
| `npm run format:check` | Fail if any file is not Prettier-formatted.                            |

## Project structure

```
src/
├── components/   Application chrome composed from KendoReact
│   └── layout/   AppShell, AppHeader
├── features/     Domain slices; one directory per feature
│   └── dashboard/
├── pages/        Route-level compositions
├── lib/          Framework-agnostic helpers, types and constants
├── styles/       Kendo theme bridge (kendo-overrides.css)
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

1. `@progress/kendo-theme-default/dist/all.css` — the Kendo baseline.
2. `src/index.css` — this project's design tokens.
3. `src/styles/kendo-overrides.css` — maps Kendo CSS variables onto those tokens.

Change the palette by editing the tokens in `src/index.css`; do not edit the Kendo theme
package.

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

Copy `.env.example` to `.env.local` and adjust as needed.

| Variable        | Default        | Purpose                                       |
| --------------- | -------------- | --------------------------------------------- |
| `VITE_APP_NAME` | `BMTM Cockpit` | Product name shown in the application header. |

## Dependency policy

`.npmrc` pins this repository to a private registry, sets `ignore-scripts=true` and enforces
`min-release-age=7`. New dependencies must have been **published** more than 7 days ago —
check the version's own entry in `npm view <pkg> time --json`, not `time.modified`, which
reports unrelated metadata changes. Pin exact versions with `npm install --save-exact`.
