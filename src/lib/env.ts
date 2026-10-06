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
