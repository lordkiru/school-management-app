import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './authContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Questions from './pages/Questions'
import Import from './pages/Import'

export default function App() {
  const { status } = useAuth()

  if (status === 'checking') {
    return (
      <p role="status" className="p-8 text-slate-700">
        Checking your sign-in...
      </p>
    )
  }
  if (status === 'out') return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="questions" element={<Questions />} />
        <Route path="import" element={<Import />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
