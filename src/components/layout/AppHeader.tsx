import { AppBar, AppBarSection, AppBarSpacer } from '@progress/kendo-react-layout'
import { Button, Chip } from '@progress/kendo-react-buttons'
import { Typography } from '@progress/kendo-react-common'
import { logoutIcon, menuIcon } from '@progress/kendo-svg-icons'
import { useAuth } from '@features/auth'
import { env } from '@lib'

export interface AppHeaderProps {
  onToggleMenu: () => void
}

export function AppHeader({ onToggleMenu }: AppHeaderProps) {
  // AppHeader is only ever rendered inside the authenticated branch of App.tsx's gate, so
  // useAuth is always called inside AuthProvider here.
  const { user, signOut } = useAuth()

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

      <AppBarSection>
        <Typography.p>{user?.email ?? user?.name ?? ''}</Typography.p>
      </AppBarSection>

      <AppBarSection>
        <Button type="button" fillMode="flat" svgIcon={logoutIcon} onClick={() => void signOut()}>
          Sign out
        </Button>
      </AppBarSection>
    </AppBar>
  )
}
