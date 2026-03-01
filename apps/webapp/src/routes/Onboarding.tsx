import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../lib/api-fetch'
import { auth } from '../lib/firebase'
import { Button } from '@mycscompanion/ui/src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mycscompanion/ui/src/components/ui/select'
import type { UserProfile } from '@mycscompanion/shared'

function Onboarding(): React.ReactElement {
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [primaryLanguage, setPrimaryLanguage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isFormComplete = role !== '' && experienceLevel !== '' && primaryLanguage !== ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiFetch<UserProfile>('/api/account/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          email: auth.currentUser?.email,
          displayName: auth.currentUser?.displayName ?? null,
          role,
          experienceLevel,
          primaryLanguage,
        }),
      })
      navigate('/overview', { replace: true })
    } catch {
      setError("Couldn't save preferences, try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-h2 font-semibold text-foreground">Tell us about yourself</h1>
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">This helps us personalize your experience.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger className="w-full min-h-11" aria-label="Your role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backend-engineer">Backend Engineer</SelectItem>
                <SelectItem value="frontend-engineer">Frontend Engineer</SelectItem>
                <SelectItem value="fullstack-engineer">Full-Stack Engineer</SelectItem>
                <SelectItem value="devops-sre">DevOps / SRE</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={experienceLevel} onValueChange={setExperienceLevel} disabled={loading}>
              <SelectTrigger className="w-full min-h-11" aria-label="Your experience level">
                <SelectValue placeholder="Select your experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="less-than-1">Less than 1 year</SelectItem>
                <SelectItem value="1-to-3">1-3 years</SelectItem>
                <SelectItem value="3-to-5">3-5 years</SelectItem>
                <SelectItem value="5-plus">5+ years</SelectItem>
              </SelectContent>
            </Select>

            <Select value={primaryLanguage} onValueChange={setPrimaryLanguage} disabled={loading}>
              <SelectTrigger className="w-full min-h-11" aria-label="Your primary programming language">
                <SelectValue placeholder="Select your language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript-typescript">JavaScript / TypeScript</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="c-cpp">C / C++</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="submit"
              disabled={!isFormComplete || loading}
              className="min-h-11"
              aria-disabled={loading}
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
            {error && (
              <p className="text-body-sm text-muted-foreground" role="alert">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { Onboarding }
