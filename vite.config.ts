import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const fromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // @progress/kendo-theme-meridian still uses the legacy Sass if() syntax;
        // silence its deprecation noise without hiding warnings from our own code.
        quietDeps: true,
      },
    },
  },
  resolve: {
    // Specific aliases are listed before the general '@' alias.
    alias: {
      '@components': fromRoot('./src/components'),
      '@features': fromRoot('./src/features'),
      '@lib': fromRoot('./src/lib'),
      '@pages': fromRoot('./src/pages'),
      '@': fromRoot('./src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // `npm run dev` serves only the SPA. Forward `/api/*` to a separately running
    // `npm run cf:dev` (Wrangler, port 8787) so the client can call its own API during
    // development. Run both processes side by side.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
