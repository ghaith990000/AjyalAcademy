import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Show the academy name next to the mark. */
  showName?: boolean
  className?: string
}

const SIZE = {
  sm: 'size-9 rounded-xl',
  md: 'size-11 rounded-xl',
  lg: 'size-24 rounded-3xl',
} as const

export function BrandLogo({ size = 'md', showName = false, className }: BrandLogoProps) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src="/brand/logo.jpg"
        alt={showName ? '' : t('app.name')}
        className={cn('shrink-0 object-cover shadow-card', SIZE[size])}
      />
      {showName && <span className="text-lg font-extrabold leading-tight">{t('app.name')}</span>}
    </span>
  )
}
