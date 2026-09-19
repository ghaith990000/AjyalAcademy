import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, isRtl, type Language } from './i18n'

/** Active UI language ('ar' | 'en') and its direction. */
export function useLanguage(): { language: Language; rtl: boolean } {
  const { i18n } = useTranslation()
  const language: Language = i18n.resolvedLanguage === 'en' ? 'en' : DEFAULT_LANGUAGE
  return { language, rtl: isRtl(language) }
}
