import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { homePathFor } from '@/features/auth/auth-context'
import { isChunkLoadError } from './chunkError'

interface ErrorScreenProps {
  error: unknown
  /** Inside the app shell (the navigation stays) rather than replacing the whole screen. */
  inline?: boolean
}

/** What a person sees when the app itself breaks: plain words, and a way out (reload, or back home). */
export function ErrorScreen({ error, inline = false }: ErrorScreenProps) {
  const { t } = useTranslation('errors')
  const chunk = isChunkLoadError(error)
  const home = location.pathname.startsWith('/coach') ? homePathFor('coach') : homePathFor('admin')

  return (
    <div
      className={inline ? 'py-6' : 'flex min-h-dvh items-center justify-center px-4'}
      role="alert"
    >
      <EmptyState
        icon={TriangleAlert}
        titleAs={inline ? 'h2' : 'h1'}
        title={t(chunk ? 'crash.chunkTitle' : 'crash.title')}
        description={t(chunk ? 'crash.chunkDescription' : 'crash.description')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => location.reload()}>{t('crash.reload')}</Button>
            <Button variant="secondary" onClick={() => location.assign(home)}>
              {t('crash.home')}
            </Button>
          </div>
        }
      />
    </div>
  )
}
