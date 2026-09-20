import { zodResolver } from '@hookform/resolvers/zod'
import type { ParseKeys } from 'i18next'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import type { SignInError } from '../auth-context'
import { clearSessionEndedNotice, sessionEndedNotice } from '../sessionNotice'
import { useAuth } from '../useAuth'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Messages are `auth` namespace keys, translated where they are rendered.
const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'validation.email.required')
    .regex(EMAIL, 'validation.email.invalid'),
  password: z.string().min(1, 'validation.password.required'),
})
type LoginValues = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'ui', 'dev'])
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [failure, setFailure] = useState<SignInError | null>(null)
  // Say once why the person is here again, then forget it.
  const [sessionEnded] = useState(sessionEndedNotice)
  useEffect(() => clearSessionEndedNotice(), [])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const message = (key?: string) => (key ? t(`auth:${key}` as ParseKeys<'auth'>) : undefined)

  async function onSubmit(values: LoginValues) {
    setFailure(null)
    const result = await signIn(values.email, values.password)
    // On success the route guard moves us to the role's home; nothing to do here.
    if (!result.ok) setFailure(result.error)
  }

  return (
    <Card className="space-y-6 p-5 md:p-7">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t('auth:title')}</h1>
        <p className="mt-1 text-ink-muted">{t('auth:subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {sessionEnded && !failure && (
          <p
            role="status"
            className="rounded-control bg-brand-blue-50 px-3.5 py-3 text-[15px] font-medium text-brand-navy"
          >
            {t('auth:sessionEnded')}
          </p>
        )}
        {failure && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 px-3.5 py-3 text-[15px] font-medium text-danger"
          >
            {t(`auth:error.${failure}`)}
          </p>
        )}
        <Field label={t('auth:email.label')} required error={message(errors.email?.message)}>
          {(control) => (
            <Input
              {...control}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="username"
              ltr
              placeholder={t('auth:email.placeholder')}
            />
          )}
        </Field>
        <Field label={t('auth:password.label')} required error={message(errors.password?.message)}>
          {(control) => (
            <Input
              {...control}
              {...register('password')}
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
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {t('auth:submit')}
        </Button>
      </form>

      <p className="border-t border-line pt-4 text-center text-[15px] text-ink-muted">
        {t('auth:register.prompt')}{' '}
        <Link
          to="/register"
          className="inline-flex min-h-11 items-center font-semibold text-brand-blue underline"
        >
          {t('auth:register.link')}
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="border-t border-dashed border-line pt-4">
          <Button asChild variant="ghost" fullWidth>
            <Link to="/dev/ui">{t('dev:previewGallery')}</Link>
          </Button>
        </div>
      )}
    </Card>
  )
}
