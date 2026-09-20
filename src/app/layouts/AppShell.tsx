import { ChevronRight, Ellipsis, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { Dialog } from '@/components/ui/Dialog'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/app/pwa/OfflineBanner'
import type { NavConfig, NavItem } from '@/app/nav'
import { useNavBadges } from '@/app/useNavBadges'

interface AppShellProps {
  nav: NavConfig
  role: 'admin' | 'coach'
}

/** How many things wait for the person. The number is for the eye; a screen reader hears what it means. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation('nav')
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full bg-brand-pink px-1.5 text-[12px] font-bold leading-5 text-white',
        className,
      )}
    >
      <span aria-hidden>{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{t('waiting', { n: count })}</span>
    </span>
  )
}

function SidebarLink({ item, count }: { item: NavItem; count: number }) {
  const { t } = useTranslation('nav')
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-control px-3 font-medium transition-colors',
          isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/8 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute inset-y-2.5 start-0 w-1 rounded-e-full bg-brand-pink"
            />
          )}
          <Icon className="size-5" aria-hidden />
          {t(item.label)}
          {/* a real space, so the name reads "Registrations 3 waiting" (flex items alone add none in every engine) */}{' '}
          <CountBadge count={count} className="ms-auto" />
        </>
      )}
    </NavLink>
  )
}

const tabClass =
  'relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1'

function TabLink({ item }: { item: NavItem }) {
  const { t } = useTranslation('nav')
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(tabClass, 'text-[13px] font-medium', isActive ? 'text-brand-blue' : 'text-ink-muted')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-brand-pink"
            />
          )}
          <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
          <span className="max-w-full truncate">{t(item.tabLabel ?? item.label)}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * Responsive app frame shared by the admin and coach areas:
 * navy sidebar from `md`; navy top bar + bottom tab bar on phones.
 */
export function AppShell({ nav, role }: AppShellProps) {
  const { t } = useTranslation(['nav', 'common', 'ui'])
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const badges = useNavBadges(role)
  const countOf = (item: NavItem) => (item.badge ? badges[item.badge] : 0)
  // On a phone the entries behind "More" are one tap away, so the tab carries what waits inside them.
  const moreCount = nav.more.reduce((sum, item) => sum + countOf(item), 0)

  const allItems = [...nav.primary, ...nav.more]
  const current = allItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  const moreActive = nav.more.some((item) => pathname.startsWith(item.to))
  const roleLabel = t(`common:roles.${role}`)
  const displayName = profile?.full_name ?? roleLabel

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-[70] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-blue focus:shadow-float"
      >
        {t('ui:skipToContent')}
      </a>

      {/* Desktop / tablet sidebar */}
      <aside className="hidden bg-brand-navy text-white md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col">
        <div className="px-5 py-6">
          <BrandLogo showName />
        </div>
        <nav aria-label={t('ui:mainNavigation')} className="flex-1 space-y-1 overflow-y-auto px-3">
          {allItems.map((item) => (
            <SidebarLink key={item.to} item={item} count={countOf(item)} />
          ))}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{displayName}</p>
              <p className="text-[13px] text-white/70">{roleLabel}</p>
            </div>
          </div>
          <LanguageToggle tone="dark" className="w-full justify-center" />
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
            {t('nav:signOut')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <OfflineBanner />

        {/* Phone app bar */}
        <header className="pt-safe sticky top-0 z-30 bg-brand-navy text-white md:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo size="sm" />
              <span className="truncate text-lg font-bold">
                {current ? t(current.label) : t('common:app.name')}
              </span>
            </div>
            <LanguageToggle tone="dark" />
          </div>
          <span aria-hidden className="block h-0.5 bg-brand-pink" />
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      {/* Phone tab bar */}
      <nav
        aria-label={t('ui:mainNavigation')}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface shadow-[0_-4px_16px_-8px_rgb(14_47_107/0.25)] md:hidden"
      >
        {nav.primary.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
        {/* Always there: it holds "Sign out", which a phone has no other place for (a coach has no extra pages). */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            tabClass,
            'text-[13px] font-medium',
            moreActive ? 'text-brand-blue' : 'text-ink-muted',
          )}
        >
          {moreActive && (
            <span
              aria-hidden
              className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-brand-pink"
            />
          )}
          <span className="relative">
            <Ellipsis className="size-6" aria-hidden />
            <CountBadge count={moreCount} className="absolute -end-3 -top-2" />
          </span>{' '}
          <span className="max-w-full truncate">{t('nav:more')}</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title={t('nav:more')}>
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={displayName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{displayName}</p>
            <p className="text-[13px] text-ink-muted">{roleLabel}</p>
          </div>
        </div>
        <ul className="-mx-2 space-y-1">
          {nav.more.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 rounded-control px-3 font-semibold transition-colors hover:bg-brand-blue-50"
                >
                  <span className="flex size-10 items-center justify-center rounded-control bg-brand-blue-50 text-brand-blue">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">{t(item.label)}</span>{' '}
                  <CountBadge count={countOf(item)} />
                  <ChevronRight className="size-5 text-ink-muted rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={() => void signOut()}
          className="-mx-2 mt-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-3 text-start font-semibold text-ink-muted transition-colors hover:bg-page"
        >
          <span className="flex size-10 items-center justify-center rounded-control bg-page">
            <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
          </span>
          {t('nav:signOut')}
        </button>
      </Dialog>
    </div>
  )
}
