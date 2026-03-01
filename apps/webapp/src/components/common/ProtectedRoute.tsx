import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../hooks/use-auth'
import { useOnboardingStatus } from '../../hooks/use-onboarding-status'

function ProtectedRoute(): React.ReactElement {
  const { user, loading } = useAuth()

  if (loading) {
    return <AuthLoadingSkeleton />
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  return <OnboardingGate />
}

function OnboardingGate(): React.ReactElement {
  const { isComplete, assessmentFailed, loading } = useOnboardingStatus()
  const location = useLocation()

  if (loading) {
    return <OnboardingLoadingSkeleton />
  }

  if (assessmentFailed && location.pathname !== '/not-ready') {
    return <Navigate to="/not-ready" replace />
  }

  if (!assessmentFailed && location.pathname === '/not-ready') {
    return <Navigate to="/overview" replace />
  }

  if (isComplete === false && !assessmentFailed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  if (isComplete === true && location.pathname === '/onboarding') {
    return <Navigate to="/overview" replace />
  }

  return <Outlet />
}

function AuthLoadingSkeleton(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 px-6">
        <div className="h-10 animate-pulse rounded-md bg-muted/60" />
        <div className="h-10 animate-pulse rounded-md bg-muted/40" />
        <div className="h-10 animate-pulse rounded-md bg-muted/30" />
      </div>
    </div>
  )
}

function OnboardingLoadingSkeleton(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 px-6">
        <div className="h-11 animate-pulse rounded-md bg-muted/60" />
        <div className="h-11 animate-pulse rounded-md bg-muted/50" />
        <div className="h-11 animate-pulse rounded-md bg-muted/40" />
        <div className="h-11 animate-pulse rounded-md bg-muted/30" />
      </div>
    </div>
  )
}

export { ProtectedRoute }
