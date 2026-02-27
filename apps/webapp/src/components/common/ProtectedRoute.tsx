import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../hooks/use-auth'

function ProtectedRoute(): React.ReactElement {
  const { user, loading } = useAuth()

  if (loading) {
    return <AuthLoadingSkeleton />
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
}

function AuthLoadingSkeleton(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-40 animate-pulse rounded-md bg-neutral-800" />
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-800" />
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 px-6">
        <div className="h-10 animate-pulse rounded-md bg-neutral-800/60" />
        <div className="h-10 animate-pulse rounded-md bg-neutral-800/40" />
        <div className="h-10 animate-pulse rounded-md bg-neutral-800/30" />
      </div>
    </div>
  )
}

export { ProtectedRoute }
