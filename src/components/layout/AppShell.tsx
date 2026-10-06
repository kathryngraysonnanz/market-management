import { useState } from 'react'
import type { ReactNode } from 'react'
import type { DrawerSelectEvent } from '@progress/kendo-react-layout'
import { Drawer, DrawerContent } from '@progress/kendo-react-layout'
import { AppHeader } from '@components/layout/AppHeader'
import { navItems } from '@lib'
import './app-shell.css'

export interface AppShellProps {
  activeItemId: string
  children: ReactNode
}

export function AppShell({ activeItemId, children }: AppShellProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedId, setSelectedId] = useState(activeItemId)

  const drawerItems = navItems.map((item) => ({
    text: item.label,
    selected: item.id === selectedId,
  }))

  const handleSelect = (event: DrawerSelectEvent) => {
    setSelectedId(navItems[event.itemIndex].id)
  }

  return (
    <div className="app-shell">
      <AppHeader onToggleMenu={() => setExpanded((previous) => !previous)} />

      <Drawer
        expanded={expanded}
        position="start"
        mode="push"
        items={drawerItems}
        onSelect={handleSelect}
      >
        <DrawerContent>
          <main className="app-shell__main">{children}</main>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
