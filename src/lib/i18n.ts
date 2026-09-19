import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import arCommon from '@/locales/ar/common.json'
import enCommon from '@/locales/en/common.json'

export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'ar'
export const LANGUAGE_STORAGE_KEY = 'ajyal.lang'

export function isRtl(language: string): boolean {
  return language === 'ar'
}

/** Keeps <html lang> and <html dir> in sync with the active language. */
export function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = language
  document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr'
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { common: arCommon },
      en: { common: enCommon },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

applyDocumentLanguage(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE)
i18n.on('languageChanged', applyDocumentLanguage)

export default i18n
