import type { ParseKeys } from 'i18next'
import { Construction, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

interface PlaceholderPageProps {
  /** Key in the `nav` namespace. */
  title: ParseKeys<'nav'>
  /** Roadmap phase that builds this page. */
  phase: number
  icon?: LucideIcon
}

export default function PlaceholderPage({
  title,
  phase,
  icon = Construction,
}: PlaceholderPageProps) {
  const { t } = useTranslation('nav')
  return (
    <>
      <PageHeader title={t(title)} />
      <EmptyState
        icon={icon}
        title={t('comingSoon.title')}
        description={t('comingSoon.description', { phase })}
      />
    </>
  )
}
