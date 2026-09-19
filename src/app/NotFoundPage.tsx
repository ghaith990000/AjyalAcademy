import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export default function NotFoundPage() {
  const { t } = useTranslation('nav')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4">
      <EmptyState
        icon={SearchX}
        title={t('notFound.title')}
        description={t('notFound.description')}
        action={
          <Button asChild>
            <Link to="/">{t('notFound.back')}</Link>
          </Button>
        }
      />
    </main>
  )
}
