import { Typography } from '@progress/kendo-react-common'
import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import '@features/auth/sign-in.css'

/**
 * Shown when `VITE_NEON_AUTH_URL` is not configured.
 *
 * Rendering a sign-in form that cannot possibly succeed would send a developer hunting for a
 * credentials problem. Naming the missing variable is the fastest route to a working app.
 */
export function AuthSetupPage() {
  return (
    <div className="sign-in">
      <Card className="sign-in__card">
        <CardHeader>
          <CardTitle>Authentication is not configured</CardTitle>
        </CardHeader>
        <CardBody>
          <Typography.p>
            <code>VITE_NEON_AUTH_URL</code> is not set, so this application cannot reach Neon Auth.
          </Typography.p>
          <Typography.p>
            Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
            <code>VITE_NEON_AUTH_URL</code> to this environment&apos;s Neon Auth base URL. See{' '}
            <code>docs/DEPLOYMENT.md</code>.
          </Typography.p>
        </CardBody>
      </Card>
    </div>
  )
}
