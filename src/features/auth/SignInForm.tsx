import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Typography } from '@progress/kendo-react-common'
import { TextBox } from '@progress/kendo-react-inputs'
import { Card, CardBody, CardHeader, CardSubtitle, CardTitle } from '@progress/kendo-react-layout'
import { useAuth } from '@features/auth'
import { env } from '@lib'
import './sign-in.css'

export interface SignInFormProps {
  /** Shown above the form when the user arrived here because their session expired. */
  notice?: string
}

export function SignInForm({ notice }: SignInFormProps) {
  const { signIn } = useAuth()
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // A real <form> with onSubmit, not a click handler: this is what makes Enter-to-submit and the
  // browser's own required-field handling work for keyboard users (Accessibility NFR).
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const message = await signIn(email, password)
    setSubmitting(false)
    if (message) {
      // Stay on this screen. No partial access is granted on a failed attempt (AC-003).
      setError(message)
      setPassword('')
    }
  }

  return (
    <div className="sign-in">
      <Card className="sign-in__card">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardSubtitle>{env.appName}</CardSubtitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={(event) => void handleSubmit(event)} className="sign-in__fields">
            {notice ? <Typography.p role="status">{notice}</Typography.p> : null}

            <div className="sign-in__field">
              <label htmlFor={emailId}>Email</label>
              <TextBox
                id={emailId}
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(String(event.value ?? ''))}
              />
            </div>

            <div className="sign-in__field">
              <label htmlFor={passwordId}>Password</label>
              <TextBox
                id={passwordId}
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(String(event.value ?? ''))}
              />
            </div>

            {error ? (
              <Typography.p role="alert" className="sign-in__error">
                {error}
              </Typography.p>
            ) : null}

            <Button type="submit" themeColor="primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
