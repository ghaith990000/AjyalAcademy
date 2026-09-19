import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { Providers } from './providers'
import { UpdatePrompt } from './pwa/UpdatePrompt'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <Providers>
      <AuthProvider>
        <RouterProvider router={router} />
        <UpdatePrompt />
      </AuthProvider>
    </Providers>
  )
}
