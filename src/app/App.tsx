import { useTranslation } from 'react-i18next'

export default function App() {
  const { t, i18n } = useTranslation()
  const nextLanguage = i18n.resolvedLanguage === 'ar' ? 'en' : 'ar'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <img
        src="/brand/logo.jpg"
        alt=""
        className="size-28 rounded-3xl shadow-card"
        width={112}
        height={112}
      />
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-brand-blue">{t('app.name')}</h1>
        <p className="text-ink-muted">{t('app.tagline')}</p>
      </div>
      <p className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        {t('app.status')}
      </p>
      <button
        type="button"
        onClick={() => void i18n.changeLanguage(nextLanguage)}
        className="min-h-11 rounded-control bg-brand-pink px-5 font-semibold text-white"
      >
        {t('language.switchTo')}
      </button>
    </main>
  )
}
