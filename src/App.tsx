import { AppShell } from '@components/layout/AppShell'
import { DashboardPage } from '@pages/DashboardPage'

/**
 * TODO: Re-enable authentication after dashboard development.
 * Currently bypassing login to show the dashboard on load.
 */
function App() {
  return (
    <AppShell activeItemId="dashboard">
      <DashboardPage />
    </AppShell>
  )
}

export default App
