import { AppShell } from '@components/layout/AppShell'
import { DashboardPage } from '@pages/DashboardPage'
import '@/App.css'

function App() {
  return (
    <AppShell activeItemId="dashboard">
      <DashboardPage />
    </AppShell>
  )
}

export default App
