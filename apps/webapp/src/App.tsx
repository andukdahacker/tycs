import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { ProtectedRoute } from './components/common/ProtectedRoute'

// Placeholder components — replaced by real implementations in Stories 2.2-2.5, 3.5+
function SignInPlaceholder(): React.ReactElement {
  return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Sign In (Story 2.2)</div>
}
function SignUpPlaceholder(): React.ReactElement {
  return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Sign Up (Story 2.2)</div>
}
function OnboardingPlaceholder(): React.ReactElement {
  return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Onboarding (Story 2.3)</div>
}
function OverviewPlaceholder(): React.ReactElement {
  return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Overview (Story 4+)</div>
}

function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/sign-in" element={<SignInPlaceholder />} />
        <Route path="/sign-up" element={<SignUpPlaceholder />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPlaceholder />} />
          <Route path="/overview" element={<OverviewPlaceholder />} />
          <Route path="/" element={<Navigate to="/overview" replace />} />
        </Route>

        {/* Catch-all — redirect unknown paths through auth check */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export { App }
