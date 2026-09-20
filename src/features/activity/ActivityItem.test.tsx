import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Providers } from '@/app/providers'
import i18n from '@/lib/i18n'
import { fakeActivity, SAMPLE_SUMMARIES } from '@/test/activity'
import { KNOWN_ACTIONS, type KnownAction } from './activity'
import { ActivityItem } from './ActivityItem'

const NOW = new Date('2026-10-19T10:00:00+00:00') // the sample rows are from 09:55, five minutes earlier

function renderItem(row: ReturnType<typeof fakeActivity>) {
  return render(
    <Providers>
      <ul>
        <ActivityItem row={row} now={NOW} />
      </ul>
    </Providers>,
  )
}

/** What a person reads: the sentence, its detail line and the time (not the avatar's initials). */
const readText = (container: HTMLElement) =>
  [...container.querySelectorAll('li p')]
    .map((paragraph) => paragraph.textContent)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

/** The sentence, then the detail line if there is one — exactly as a person reads it. */
const EXPECTED: Record<'en' | 'ar', Record<KnownAction | 'player.created (no coach)', string>> = {
  en: {
    'player.created':
      'Demo Admin added the player Yousef Al Mahmood to the team of Khalid Al Dosari',
    'player.created (no coach)': 'Demo Admin added the player Yousef Al Mahmood',
    'player.updated': 'Demo Admin updated the player Yousef Al Mahmood',
    'player.removed': 'Demo Admin removed the player Yousef Al Mahmood',
    'player.reassigned':
      'Demo Admin moved Yousef Al Mahmood from Khalid Al Dosari to Sara Al Khalifa',
    'subscription.created':
      'Demo Admin created a Duo subscription for Ali Hassan and Omar Hassan (35.000 BD) Location: Al-Rifa',
    'subscription.location_changed':
      'Demo Admin moved the subscription of Ali Hassan to Hamad City It was: Al-Rifa',
    'subscription.cancelled':
      'Demo Admin cancelled the subscription of Ali Hassan Reason: Moved away',
    'payment.recorded':
      'Demo Admin recorded a payment of 20.000 BD for Ali Hassan Balance left: 15.000 BD',
    'discount.created': 'Demo Admin added the discount Sibling discount (12.5%)',
    'session.created':
      'Demo Admin scheduled a session for Khalid Al Dosari on 19/09/2026 at 4:00 PM Location: Al-Rifa',
    'session.cancelled': 'Demo Admin cancelled the session of Khalid Al Dosari on 19/09/2026',
    'attendance.saved':
      'Demo Admin took attendance for the session of Khalid Al Dosari on 19/09/2026: 6 of 8 present',
    'expense.created': 'Demo Admin added an expense: Field rent, 50.000 BD',
    'expense.updated': 'Demo Admin edited an expense: Field rent, 55.000 BD',
    'expense.deleted': 'Demo Admin deleted an expense: Transportation, 10.000 BD',
    'expense.salaries_generated':
      'Demo Admin generated the salaries for October 2026: 2 created, 250.000 BD in total',
    'coach.created': 'Demo Admin added the coach Sara Al Khalifa',
    'location.created': 'Demo Admin added the location Al-Rifa',
    'location.updated': 'Demo Admin updated the location Hamad City Renamed from Hamad',
  },
  ar: {
    'player.created':
      'أُضيف اللاعب Yousef Al Mahmood إلى فريق المدرب Khalid Al Dosari بواسطة Demo Admin',
    'player.created (no coach)': 'أُضيف اللاعب Yousef Al Mahmood بواسطة Demo Admin',
    'player.updated': 'عُدّلت بيانات اللاعب Yousef Al Mahmood بواسطة Demo Admin',
    'player.removed': 'أُزيل اللاعب Yousef Al Mahmood بواسطة Demo Admin',
    'player.reassigned':
      'نُقل اللاعب Yousef Al Mahmood من Khalid Al Dosari إلى Sara Al Khalifa بواسطة Demo Admin',
    'subscription.created':
      'أُنشئ اشتراك ثنائية لـ Ali Hassan وOmar Hassan (35.000 د.ب) بواسطة Demo Admin الموقع: Al-Rifa',
    'subscription.location_changed':
      'نُقل اشتراك Ali Hassan إلى الموقع Hamad City بواسطة Demo Admin كان: Al-Rifa',
    'subscription.cancelled': 'أُلغي اشتراك Ali Hassan بواسطة Demo Admin السبب: Moved away',
    'payment.recorded':
      'سُجّلت دفعة بقيمة 20.000 د.ب عن Ali Hassan بواسطة Demo Admin المتبقي: 15.000 د.ب',
    'discount.created': 'أُضيف الخصم Sibling discount (12.5%) بواسطة Demo Admin',
    'session.created':
      'جُدولت حصة للمدرب Khalid Al Dosari بتاريخ 19/09/2026 الساعة 4:00 م بواسطة Demo Admin الموقع: Al-Rifa',
    'session.cancelled': 'أُلغيت حصة المدرب Khalid Al Dosari بتاريخ 19/09/2026 بواسطة Demo Admin',
    'attendance.saved':
      'سُجّل حضور حصة المدرب Khalid Al Dosari بتاريخ 19/09/2026: حضر 6 من 8 — بواسطة Demo Admin',
    'expense.created': 'أُضيف مصروف: إيجار الملعب، 50.000 د.ب بواسطة Demo Admin',
    'expense.updated': 'عُدّل مصروف: إيجار الملعب، 55.000 د.ب بواسطة Demo Admin',
    'expense.deleted': 'حُذف مصروف: المواصلات، 10.000 د.ب بواسطة Demo Admin',
    'expense.salaries_generated':
      'أُنشئت رواتب أكتوبر 2026: 2 — الإجمالي 250.000 د.ب بواسطة Demo Admin',
    'coach.created': 'أُضيف المدرب Sara Al Khalifa بواسطة Demo Admin',
    'location.created': 'أُضيف الموقع Al-Rifa بواسطة Demo Admin',
    'location.updated': 'عُدّل الموقع Hamad City بواسطة Demo Admin كان اسمه Hamad',
  },
}

const TIME_AGO = { en: '5 minutes ago', ar: 'قبل 5 دقائق' }

describe.each(['en', 'ar'] as const)('ActivityItem sentences (%s)', (lang) => {
  beforeEach(async () => {
    await i18n.changeLanguage(lang)
  })

  it.each(KNOWN_ACTIONS)('writes a sentence for %s', (action) => {
    const { container } = renderItem(fakeActivity(action, SAMPLE_SUMMARIES[action]))
    expect(readText(container)).toBe(`${EXPECTED[lang][action]} ${TIME_AGO[lang]}`)
  })

  it('has a shorter sentence for a player nobody coaches yet', () => {
    const { container } = renderItem(
      fakeActivity('player.created', { player_name: 'Yousef Al Mahmood', coach_name: null }),
    )
    expect(readText(container)).toBe(
      `${EXPECTED[lang]['player.created (no coach)']} ${TIME_AGO[lang]}`,
    )
  })

  it('never leaks a tag, a placeholder, a key or "undefined"', () => {
    for (const action of [...KNOWN_ACTIONS, 'something.new']) {
      const { container, unmount } = renderItem(
        fakeActivity(action, SAMPLE_SUMMARIES[action as KnownAction] ?? {}),
      )
      expect(container.textContent).not.toMatch(/[<>]|\{\{|undefined|null|activity:|action\./)
      unmount()
    }
  })

  it('falls back to a generic sentence for an action it does not know', () => {
    const { container } = renderItem(fakeActivity('badge.awarded', { badge: 'gold' }))
    expect(container).toHaveTextContent(
      lang === 'en' ? 'Demo Admin made a change' : 'أُجري تغيير بواسطة Demo Admin',
    )
  })

  it('still reads well when the snapshot is missing values', () => {
    const { container } = renderItem(fakeActivity('player.reassigned', { player_name: 'Ali' }))
    const noCoach = lang === 'en' ? 'no coach' : 'بلا مدرب'
    expect(container).toHaveTextContent(new RegExp(`Ali.*${noCoach}.*${noCoach}`))
  })

  it('copes with an empty or malformed summary and a missing actor name', () => {
    const empty = renderItem(fakeActivity('payment.recorded', {}, { summary: {} }))
    expect(empty.container.textContent).toContain(lang === 'en' ? 'Someone' : 'شخص ما')
    expect(empty.container.textContent).toContain('—')
    empty.unmount()

    for (const summary of [null, [], 'text', 7] as const) {
      const { container, unmount } = renderItem(
        fakeActivity('session.created', {}, { summary: summary as never }),
      )
      expect(container.textContent).not.toMatch(/undefined|null|NaN/)
      unmount()
    }
  })
})

describe('ActivityItem details', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('says "Paid in full" when nothing is left to pay', () => {
    renderItem(
      fakeActivity('payment.recorded', {
        ...SAMPLE_SUMMARIES['payment.recorded'],
        balance_fils: 0,
      }),
    )
    expect(screen.getByText('Paid in full')).toBeInTheDocument()
  })

  it('leaves the reason out when a subscription was cancelled without one', () => {
    renderItem(fakeActivity('subscription.cancelled', { player_names: ['Ali'], reason: '  ' }))
    expect(screen.queryByText(/Reason/)).not.toBeInTheDocument()
  })

  it('shows a plan the app has no translation for by its code', () => {
    const { container } = renderItem(
      fakeActivity('subscription.created', {
        player_names: ['Ali'],
        plan: 'family',
        total_fils: 1000,
      }),
    )
    expect(container).toHaveTextContent('created a family subscription')
  })

  it('shows the discount as a percent or as money', () => {
    const { container, unmount } = renderItem(
      fakeActivity('discount.created', {
        discount_name: 'Ramadan',
        discount_type: 'fixed',
        value: 5000,
      }),
    )
    expect(container).toHaveTextContent('Ramadan (5.000 BD)')
    unmount()
  })

  it('names the actor with an avatar and gives the time as a machine-readable element', () => {
    renderItem(fakeActivity('player.removed', { player_name: 'Ali' }))
    expect(screen.getByRole('img', { name: 'Demo Admin' })).toBeInTheDocument()
    const time = screen.getByText('5 minutes ago')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('dateTime', '2026-10-19T09:55:00+00:00')
    expect(time).toHaveAttribute('title', expect.stringMatching(/^\d{2}\/\d{2}\/\d{4} /))
  })

  it('writes an old entry as a plain date', () => {
    renderItem(
      fakeActivity(
        'player.removed',
        { player_name: 'Ali' },
        { created_at: '2026-10-01T09:00:00+00:00' },
      ),
    )
    expect(screen.getByText('01/10/2026')).toBeInTheDocument()
  })
})
