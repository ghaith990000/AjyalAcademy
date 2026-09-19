import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'

/** Static login screen (Phase 1). Real authentication is wired in Phase 2. */
export default function LoginPage() {
  const { t } = useTranslation(['auth', 'ui', 'dev'])
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
  }

  return (
    <Card className="space-y-6 p-5 md:p-7">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t('auth:title')}</h1>
        <p className="mt-1 text-ink-muted">{t('auth:subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label={t('auth:email.label')} required>
          {(control) => (
            <Input
              {...control}
              type="email"
              inputMode="email"
              autoComplete="username"
              ltr
              placeholder={t('auth:email.placeholder')}
            />
          )}
        </Field>
        <Field label={t('auth:password.label')} required>
          {(control) => (
            <Input
              {...control}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              ltr
              placeholder={t('auth:password.placeholder')}
              endAdornment={
                <IconButton
                  label={showPassword ? t('ui:hidePassword') : t('ui:showPassword')}
                  icon={showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  onClick={() => setShowPassword((value) => !value)}
                />
              }
            />
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth>
          {t('auth:submit')}
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="space-y-2 border-t border-dashed border-line pt-4">
          <Button asChild variant="secondary" fullWidth>
            <Link to="/admin">{t('dev:previewAdmin')}</Link>
          </Button>
          <Button asChild variant="secondary" fullWidth>
            <Link to="/coach">{t('dev:previewCoach')}</Link>
          </Button>
          <Button asChild variant="ghost" fullWidth>
            <Link to="/dev/ui">{t('dev:previewGallery')}</Link>
          </Button>
        </div>
      )}
    </Card>
  )
}
