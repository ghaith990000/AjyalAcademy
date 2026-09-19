import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { installMockApi, type Api, type Person } from './mock-api'

export const LANGS = ['ar', 'en'] as const
export type Lang = (typeof LANGS)[number]

const cache = new Map<string, unknown>()
function namespace(lang: Lang, ns: string): unknown {
  const key = `${lang}/${ns}`
  if (!cache.has(key)) {
    cache.set(
      key,
      JSON.parse(readFileSync(new URL(`../../src/locales/${key}.json`, import.meta.url), 'utf8')),
    )
  }
  return cache.get(key)
}

/** The app's own words: `t('en', 'players:form.fullName.label')` — so specs never hard-code a translation. */
export function t(lang: Lang, key: string): string {
  const [ns, path] = key.split(':') as [string, string]
  let node = namespace(lang, ns) as Record<string, unknown>
  for (const part of path.split('.')) node = node[part] as Record<string, unknown>
  if (typeof node !== 'string') throw new Error(`No text at ${lang} ${key}`)
  return node
}

/** Open the app in `lang`, signed in as `person` (or signed out), with the mock API in place. */
export async function openApp(
  page: Page,
  person: Person | null,
  lang: Lang,
  path = '/',
): Promise<Api> {
  const api = await installMockApi(page, { as: person, lang })
  await page.goto(path)
  return api
}

/** No sideways scroll and no tap target under 44px (a switch's label row counts as its target). */
export async function expectMobileLayout(page: Page, label: string, scope = 'main'): Promise<void> {
  const problems = await page.evaluate((scopeSelector) => {
    const root = document.querySelector(scopeSelector) ?? document.body
    const vw = document.documentElement.clientWidth
    const small = [
      ...root.querySelectorAll(
        'a[href], button, select, input:not([type=hidden]), textarea, [role=tab]',
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return (
          r.width > 0 &&
          r.height > 0 &&
          cs.visibility !== 'hidden' &&
          !el.closest('[aria-hidden=true]') &&
          el.getAttribute('role') !== 'switch' &&
          !(el.tagName === 'INPUT' && el.closest('label, [role=switch]')) &&
          !el.classList.contains('sr-only') &&
          !el.closest('.sr-only')
        )
      })
      .filter((el) => el.getBoundingClientRect().height < 43.5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`,
      )
    return { scrollWidth: document.documentElement.scrollWidth, vw, small }
  }, scope)
  expect(problems.scrollWidth, `${label}: page scrolls sideways`).toBeLessThanOrEqual(
    problems.vw + 1,
  )
  expect(problems.small, `${label}: tap targets under 44px`).toEqual([])
}

/** WCAG 2.1 A + AA (contrast, names, roles, landmarks…) — anything axe reports fails the test with its details. */
export async function expectAccessible(page: Page, label: string, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
  expect(summary, `${label}: accessibility violations`).toEqual([])
}
