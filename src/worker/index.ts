/**
 * Cloudflare Worker entry point.
 *
 * Only requests matching `assets.run_worker_first` in `wrangler.jsonc` reach this
 * module. Every other request is served directly from `dist/` by the Asset Worker,
 * including SPA deep links.
 *
 * Server-side secrets are read from the `env` argument. They never reach the browser.
 * Never import anything from this directory into `src/` application code.
 */
import { handleDbHealth, handleHealth } from './routes/health.ts'
import type { WorkerEnv } from './types.ts'

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/health') {
      return handleHealth()
    }

    if (pathname === '/api/db/health') {
      return handleDbHealth(env)
    }

    return Response.json({ error: 'not found' }, { status: 404 })
  },
} satisfies ExportedHandler<WorkerEnv>
