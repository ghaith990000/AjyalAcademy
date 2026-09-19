import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { Providers } from './providers'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <Providers>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Providers>
  )
}
