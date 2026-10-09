import { AppShell } from '@components/layout/AppShell'
import { useAuth } from '@features/auth'
import { AuthSetupPage } from '@pages/AuthSetupPage'
import { DashboardPage } from '@pages/DashboardPage'
import { SignInPage } from '@pages/SignInPage'

/**
 * The application's single authentication gate.
 *
 * Protected UI is not hidden — it is never constructed. `AppShell` and `DashboardPage` are only
 * reachable through the `authed` branch, so there is no URL, deep link or back-button navigation
 * that can render them for an anonymous visitor (AC-001, AC-004). `wrangler.jsonc` already serves
 * index.html for every unmatched path, so every deep link boots into this gate.
 *
 * When a router is eventually introduced for Vendors / Schedule / Budget, it is mounted INSIDE the
 * `authed` branch. This gate does not need to change.
 */
function App() {
  const { status } = useAuth()

  if (status === 'misconfigured') {
    return <AuthSetupPage />
  }

  if (status === 'loading') {
    return null
  }

  if (status !== 'authed') {
    return (
      <SignInPage
        notice={status === 'expired' ? 'Your session expired. Please sign in again.' : undefined}
      />
    )
  }

  return (
    <AppShell activeItemId="dashboard">
      <DashboardPage />
    </AppShell>
  )
}

export default App
