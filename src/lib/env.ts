/**
 * Build-time application configuration.
 *
 * Every value here originates from a `VITE_*` environment variable, which Vite
 * inlines into the production bundle. These values are PUBLIC. Do not add any
 * secret (API key, token, password) to this module or to any `VITE_*` variable.
 *
 * Secrets belong in Cloudflare Worker secrets and must be read server-side.
 * See `.dev.vars.example` and `docs/DEPLOYMENT.md`.
 */
export interface AppEnv {
  /** Product display name shown in the application header. */
  appName: string
  /** Vite mode: 'development', 'production', or a custom mode. */
  mode: string
  /** True when built for production. */
  isProduction: boolean
}

export const env: AppEnv = {
  appName: import.meta.env.VITE_APP_NAME ?? 'BMTM Cockpit',
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
}
