import arActivity from '@/locales/ar/activity.json'
import arAttendance from '@/locales/ar/attendance.json'
import arAuth from '@/locales/ar/auth.json'
import arCommon from '@/locales/ar/common.json'
import arCoaches from '@/locales/ar/coaches.json'
import arDiscounts from '@/locales/ar/discounts.json'
import arDev from '@/locales/ar/dev.json'
import arErrors from '@/locales/ar/errors.json'
import arExpenses from '@/locales/ar/expenses.json'
import arHome from '@/locales/ar/home.json'
import arNav from '@/locales/ar/nav.json'
import arPlayers from '@/locales/ar/players.json'
import arPwa from '@/locales/ar/pwa.json'
import arReports from '@/locales/ar/reports.json'
import arSessions from '@/locales/ar/sessions.json'
import arSettings from '@/locales/ar/settings.json'
import arSubscriptions from '@/locales/ar/subscriptions.json'
import arUi from '@/locales/ar/ui.json'
import enActivity from '@/locales/en/activity.json'
import enAttendance from '@/locales/en/attendance.json'
import enAuth from '@/locales/en/auth.json'
import enCommon from '@/locales/en/common.json'
import enCoaches from '@/locales/en/coaches.json'
import enDiscounts from '@/locales/en/discounts.json'
import enDev from '@/locales/en/dev.json'
import enErrors from '@/locales/en/errors.json'
import enExpenses from '@/locales/en/expenses.json'
import enHome from '@/locales/en/home.json'
import enNav from '@/locales/en/nav.json'
import enPlayers from '@/locales/en/players.json'
import enPwa from '@/locales/en/pwa.json'
import enReports from '@/locales/en/reports.json'
import enSessions from '@/locales/en/sessions.json'
import enSettings from '@/locales/en/settings.json'
import enSubscriptions from '@/locales/en/subscriptions.json'
import enUi from '@/locales/en/ui.json'

/** One namespace per feature. `en` is the typing source for `t()` keys (see i18next.d.ts). */
export const resources = {
  en: {
    common: enCommon,
    ui: enUi,
    nav: enNav,
    auth: enAuth,
    home: enHome,
    dev: enDev,
    errors: enErrors,
    coaches: enCoaches,
    players: enPlayers,
    discounts: enDiscounts,
    settings: enSettings,
    subscriptions: enSubscriptions,
    sessions: enSessions,
    attendance: enAttendance,
    expenses: enExpenses,
    reports: enReports,
    activity: enActivity,
    pwa: enPwa,
  },
  ar: {
    common: arCommon,
    ui: arUi,
    nav: arNav,
    auth: arAuth,
    home: arHome,
    dev: arDev,
    errors: arErrors,
    coaches: arCoaches,
    players: arPlayers,
    discounts: arDiscounts,
    settings: arSettings,
    subscriptions: arSubscriptions,
    sessions: arSessions,
    attendance: arAttendance,
    expenses: arExpenses,
    reports: arReports,
    activity: arActivity,
    pwa: arPwa,
  },
} as const

export const NAMESPACES = Object.keys(resources.en) as (keyof typeof resources.en)[]
