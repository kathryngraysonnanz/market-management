import {
  Card,
  CardBody,
  CardHeader,
  CardSubtitle,
  CardTitle,
  GridLayout,
  GridLayoutItem,
} from '@progress/kendo-react-layout'
import { Chip } from '@progress/kendo-react-buttons'
import { Typography } from '@progress/kendo-react-common'
import type { DashboardMetric, DataSourceStatus } from '@lib'
import './dashboard-overview.css'

const metrics: DashboardMetric[] = [
  { id: 'vendors', label: 'Confirmed vendors', value: '—', caption: 'Awaiting vendor API' },
  { id: 'weather', label: 'Market-day forecast', value: '—', caption: 'Awaiting weather API' },
  { id: 'budget', label: 'Budget remaining', value: '—', caption: 'Awaiting budget API' },
  { id: 'inbox', label: 'Unread emails', value: '—', caption: 'Awaiting email API' },
]

const dataSources: DataSourceStatus[] = [
  { id: 'weather', label: 'Weather', connected: false },
  { id: 'email', label: 'Email', connected: false },
  { id: 'budget', label: 'Budget', connected: false },
]

export function DashboardOverview() {
  return (
    <div className="dashboard">
      <Typography.h3>Market overview</Typography.h3>

      <GridLayout
        className="dashboard__grid"
        gap={{ rows: 16, cols: 16 }}
        cols={[{ width: '1fr' }, { width: '1fr' }, { width: '1fr' }, { width: '1fr' }]}
      >
        {metrics.map((metric) => (
          <GridLayoutItem key={metric.id}>
            <Card>
              <CardHeader>
                <CardTitle>{metric.label}</CardTitle>
                <CardSubtitle>{metric.caption}</CardSubtitle>
              </CardHeader>
              <CardBody>
                <Typography.h4>{metric.value}</Typography.h4>
              </CardBody>
            </Card>
          </GridLayoutItem>
        ))}
      </GridLayout>

      <div className="dashboard__sources">
        {dataSources.map((source) => (
          <Chip
            key={source.id}
            text={`${source.label}: ${source.connected ? 'connected' : 'not connected'}`}
            themeColor={source.connected ? 'success' : 'base'}
          />
        ))}
      </div>
    </div>
  )
}
