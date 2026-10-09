import { SignInForm } from '@features/auth/SignInForm'

export interface SignInPageProps {
  notice?: string
}

export function SignInPage({ notice }: SignInPageProps) {
  return <SignInForm notice={notice} />
}
