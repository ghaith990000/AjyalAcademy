import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/lib/useLanguage'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
  /** `dark` for navy backgrounds (sidebar, mobile app bar), `light` for white surfaces. */
  tone?: 'light' | 'dark'
  className?: string
}

/** Switches Arabic ⇄ English. The label is the language you will switch *to*, in that language. */
export function LanguageToggle({ tone = 'light', className }: LanguageToggleProps) {
  const { t, i18n } = useTranslation()
  const { language } = useLanguage()
  const next = language === 'ar' ? 'en' : 'ar'

  return (
    <button
      type="button"
      lang={next}
      onClick={() => void i18n.changeLanguage(next)}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 text-[15px] font-semibold transition-colors',
        tone === 'dark'
          ? 'bg-white/10 text-white hover:bg-white/20'
          : 'border border-line bg-surface text-brand-blue hover:bg-brand-blue-50',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {t('language.switchTo')}
    </button>
  )
}
