/// <reference types="vite/client" />

/**
 * Declarations for this project's `VITE_*` build-time variables.
 *
 * Adding a name here makes it type-safe AND makes it public — Vite inlines the
 * value into the shipped bundle. Never declare a secret here.
 *
 * Any name added here must also be added to `.env.example` and to the
 * "Environment variables" table in README.md.
 */
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
}
