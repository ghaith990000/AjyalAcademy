import { describe, expect, it } from 'vitest'

/**
 * Project-wide guards from docs/07-i18n.md:
 *  1. `ar` and `en` locale files have identical key sets.
 *  2. No physical-direction Tailwind classes (RTL must use logical ones).
 */

const localeModules = import.meta.glob('/src/locales/*/*.json', { eager: true, import: 'default' })

function flatten(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return [prefix]
}

describe('locale files', () => {
  const byNamespace = new Map<string, Record<string, string[]>>()
  for (const [path, content] of Object.entries(localeModules)) {
    const match = /\/locales\/(ar|en)\/(.+)\.json$/.exec(path)
    if (!match) continue
    const [, lang, namespace] = match as unknown as [string, string, string]
    byNamespace.set(namespace, { ...byNamespace.get(namespace), [lang]: flatten(content).sort() })
  }

  it('has at least the core namespaces', () => {
    expect([...byNamespace.keys()]).toEqual(expect.arrayContaining(['common', 'nav', 'auth', 'ui']))
  })

  it.each([...byNamespace.entries()])('namespace "%s" has identical ar/en keys', (_ns, langs) => {
    expect(langs.ar).toBeDefined()
    expect(langs.en).toBeDefined()
    expect(langs.ar).toEqual(langs.en)
  })
})

// Matches physical utilities in class strings: ml-, mr-, pl-, pr-, left-, right-, text-left/right,
// rounded-l/r/tl/tr/bl/br, border-l/r, float-left/right (optionally with variant prefixes and a leading "-").
export const PHYSICAL_CLASS =
  /(?<=[\s"'`:{])(?:-?(?:m[lr]|p[lr]|left|right)-(?:\d|\[|px\b|auto\b|full\b)|text-(?:left|right)\b|rounded-(?:[lr]|[tb][lr])(?:-|(?=[\s"'`}]))|border-[lr](?:-|(?=[\s"'`}]))|(?:float|clear)-(?:left|right)\b)/g

describe('physical-direction class guard', () => {
  it('detects physical classes', () => {
    for (const bad of [
      'ml-2',
      'md:pr-4',
      '-mr-1',
      'text-left',
      'rounded-l-xl',
      'rounded-tr',
      'border-r',
      'left-0',
      'hover:right-2',
    ]) {
      expect(` ${bad} `.match(PHYSICAL_CLASS), bad).not.toBeNull()
    }
  })

  it('allows logical classes', () => {
    for (const ok of [
      'ms-2',
      'pe-4',
      'text-start',
      'rounded-s-xl',
      'border-e',
      'start-0',
      'inset-x-0',
    ]) {
      expect(` ${ok} `.match(PHYSICAL_CLASS), ok).toBeNull()
    }
  })

  const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>

  it('is not used anywhere in src/', () => {
    const offenders: string[] = []
    for (const [file, code] of Object.entries(sources)) {
      code.split('\n').forEach((line, index) => {
        if (line.match(PHYSICAL_CLASS)) offenders.push(`${file}:${index + 1}  ${line.trim()}`)
      })
    }
    expect(
      offenders,
      `Use logical utilities (ms-/me-/ps-/pe-/start-/end-):\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
