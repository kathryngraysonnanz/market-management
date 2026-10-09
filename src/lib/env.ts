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
  /**
   * Base URL of this environment's Neon Auth (Managed Better Auth) instance.
   *
   * Public by design — the browser calls this host directly. This issue introduces no client-side
   * auth secret of any kind: Managed Better Auth needs no publishable key and no client key, so
   * there is nothing here that could leak through the bundle.
   *
   * Empty string when unset. `src/features/auth/auth-client.ts` treats an empty value as a
   * configuration error and renders an explicit setup message rather than failing obscurely.
   */
  neonAuthUrl: string
}

export const env: AppEnv = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Market Management',
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  neonAuthUrl: import.meta.env.VITE_NEON_AUTH_URL ?? '',
}
