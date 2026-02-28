import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router'
import { useAuth } from '../hooks/use-auth'
import { signInWithEmail, signInWithGithub, mapFirebaseError } from '../lib/firebase'
import { Button } from '@mycscompanion/ui/src/components/ui/button'
import { Input } from '@mycscompanion/ui/src/components/ui/input'
import { Label } from '@mycscompanion/ui/src/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
import { Separator } from '@mycscompanion/ui/src/components/ui/separator'

function SignIn(): React.ReactElement {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" aria-busy="true">
        <Card className="w-full max-w-[400px]">
          <CardHeader className="text-center">
            <CardTitle>
              <div className="mx-auto h-7 w-48 rounded bg-muted" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="h-11 rounded bg-muted" />
              <div className="h-11 rounded bg-muted" />
              <div className="h-11 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/overview" replace />
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(mapFirebaseError(err) ?? 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGithubSignIn = async (): Promise<void> => {
    setError(null)
    setGithubLoading(true)
    try {
      const { isNewUser } = await signInWithGithub()
      if (isNewUser) {
        navigate('/onboarding', { replace: true })
      } else {
        navigate('/overview', { replace: true })
      }
    } catch (err) {
      const message = mapFirebaseError(err)
      if (message !== null) {
        setError(message)
      }
    } finally {
      setGithubLoading(false)
    }
  }

  const isDisabled = submitting || githubLoading

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-h2 text-foreground">mycscompanion</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" aria-describedby={error ? 'form-error' : undefined}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isDisabled}
                required
                className="min-h-11"
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isDisabled}
                required
                className="min-h-11"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              disabled={isDisabled}
              className="min-h-11"
              aria-disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
            {error && (
              <p id="form-error" className="text-body-sm text-muted-foreground" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="relative my-6 flex items-center">
            <Separator className="flex-1" />
            <span className="px-3 text-body-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={isDisabled}
            aria-disabled={githubLoading}
            onClick={() => void handleGithubSignIn()}
          >
            {githubLoading ? 'Connecting...' : 'Sign in with GitHub'}
          </Button>

          <p className="mt-6 text-center text-body-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/sign-up" className="py-2 text-foreground underline underline-offset-4 hover:text-primary">
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export { SignIn }
