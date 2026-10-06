/** A single entry in the application sidebar. */
export interface NavItem {
  id: string
  label: string
  href: string
}

/** Connection state of an external integration (weather, email, budget, ...). */
export interface DataSourceStatus {
  id: string
  label: string
  connected: boolean
}

/** A single headline metric rendered on the dashboard. */
export interface DashboardMetric {
  id: string
  label: string
  value: string
  caption: string
}
