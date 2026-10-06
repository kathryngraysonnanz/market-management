import { AppBar, AppBarSection, AppBarSpacer } from '@progress/kendo-react-layout'
import { Button, Chip } from '@progress/kendo-react-buttons'
import { Typography } from '@progress/kendo-react-common'
import { menuIcon } from '@progress/kendo-svg-icons'
import { env } from '@lib'

export interface AppHeaderProps {
  onToggleMenu: () => void
}

export function AppHeader({ onToggleMenu }: AppHeaderProps) {
  return (
    <AppBar themeColor="base" position="top" positionMode="sticky">
      <AppBarSection>
        <Button
          type="button"
          fillMode="flat"
          svgIcon={menuIcon}
          aria-label="Toggle navigation"
          onClick={onToggleMenu}
        />
      </AppBarSection>

      <AppBarSection>
        <Typography.h5>{env.appName}</Typography.h5>
      </AppBarSection>

      <AppBarSpacer />

      <AppBarSection>
        <Chip text={env.mode} themeColor="info" />
      </AppBarSection>
    </AppBar>
  )
}
