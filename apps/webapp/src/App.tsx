import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { SignIn } from './routes/SignIn'
import { SignUp } from './routes/SignUp'

// Placeholder components — replaced by real implementations in Stories 2.3-2.5, 3.5+
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
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

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
