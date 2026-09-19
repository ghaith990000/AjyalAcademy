import arAuth from '@/locales/ar/auth.json'
import arCommon from '@/locales/ar/common.json'
import arDev from '@/locales/ar/dev.json'
import arHome from '@/locales/ar/home.json'
import arNav from '@/locales/ar/nav.json'
import arUi from '@/locales/ar/ui.json'
import enAuth from '@/locales/en/auth.json'
import enCommon from '@/locales/en/common.json'
import enDev from '@/locales/en/dev.json'
import enHome from '@/locales/en/home.json'
import enNav from '@/locales/en/nav.json'
import enUi from '@/locales/en/ui.json'

/** One namespace per feature. `en` is the typing source for `t()` keys (see i18next.d.ts). */
export const resources = {
  en: { common: enCommon, ui: enUi, nav: enNav, auth: enAuth, home: enHome, dev: enDev },
  ar: { common: arCommon, ui: arUi, nav: arNav, auth: arAuth, home: arHome, dev: arDev },
} as const

export const NAMESPACES = Object.keys(resources.en) as (keyof typeof resources.en)[]
