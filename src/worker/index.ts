/**
 * Cloudflare Worker entry point.
 *
 * Only requests matching `assets.run_worker_first` in `wrangler.jsonc` reach this module. Every
 * other request is served directly from `dist/` by the Asset Worker, including SPA deep links.
 *
 * Server-side secrets are read from the `env` argument. They never reach the browser.
 * Never import anything from this directory into `src/` application code.
 *
 * ROUTING IS DENY-BY-DEFAULT. `classifyRoute` (in `routing.ts`, unit-tested in
 * `scripts/worker-routing.test.ts`) is the single source of truth for which paths are public;
 * `publicHandlers` and `protectedHandlers` below are keyed off the same path constants it exports,
 * so the handler wiring and the public/protected/not-found classification can never drift apart.
 * Protected handlers take an already-verified `AuthenticatedUser` as a required argument and
 * therefore cannot run for an anonymous caller. Adding a path to `routing.ts`'s public set is a
 * security decision and must be justified in review.
 */
import { authenticate, unauthorized } from './auth.ts'
import type { AuthenticatedUser } from './auth-types.ts'
import { handleDbHealth, handleHealth } from './routes/health.ts'
import { handleMe } from './routes/me.ts'
import { classifyRoute, DB_HEALTH_PATH, HEALTH_PATH, ME_PATH } from './routing.ts'
import type { WorkerEnv } from './types.ts'

type PublicHandler = (request: Request, env: WorkerEnv) => Response | Promise<Response>

type ProtectedHandler = (
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
) => Response | Promise<Response>

const publicHandlers: Record<string, PublicHandler> = {
  [HEALTH_PATH]: () => handleHealth(),
  [DB_HEALTH_PATH]: (_request, env) => handleDbHealth(env),
}

const protectedHandlers: Record<string, ProtectedHandler> = {
  [ME_PATH]: (_request, _env, user) => handleMe(user),
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)
    const kind = classifyRoute(pathname)

    if (kind === 'public') {
      return publicHandlers[pathname](request, env)
    }

    if (kind === 'not-found') {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    const user = await authenticate(request, env)
    if (!user) {
      return unauthorized()
    }

    return protectedHandlers[pathname](request, env, user)
  },
} satisfies ExportedHandler<WorkerEnv>
