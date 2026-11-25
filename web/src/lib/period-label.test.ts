import { describe, expect, test } from 'bun:test'

import type { Catalog, Vars } from '../i18n/catalog'
import { en, type MessageKey } from '../i18n/locales/en'
import { zhCN } from '../i18n/locales/zh-CN'
import { translate } from '../i18n/translate'
import { formatPeriodLabel, parsePeriodRange } from './period-label'

function tFor(catalog: Catalog, locale: string) {
  return (key: MessageKey, vars?: Vars) => translate(catalog, locale, key, vars)
}

describe('formatPeriodLabel', () => {
  test('spells a year, quarter, and month in English', () => {
    const t = tFor(en as Catalog, 'en')
    expect(formatPeriodLabel('2026', t)).toBe('2026')
    expect(formatPeriodLabel('2026-Q2', t)).toBe('2026 Q2')
    expect(formatPeriodLabel('2026-03', t)).toBe('2026-03')
  })

  test('spells the same tokens in Chinese without an English Q', () => {
    const t = tFor(zhCN as Catalog, 'zh-CN')
    expect(formatPeriodLabel('2026', t)).toBe('2026年')
    expect(formatPeriodLabel('2026-Q2', t)).toBe('2026年2季')
    expect(formatPeriodLabel('2026-03', t)).toBe('2026年03月')
  })

  test('uses the all-time label for an empty filter', () => {
    expect(formatPeriodLabel('', tFor(en as Catalog, 'en'))).toBe('All time')
    expect(formatPeriodLabel('', tFor(zhCN as Catalog, 'zh-CN'))).toBe('全部期间')
  })
})

describe('parsePeriodRange', () => {
  test('reads Fava start - end ranges', () => {
    expect(parsePeriodRange('2026-07-01 - 2026-09-15')).toEqual({
      start: '2026-07-01',
      end: '2026-09-15',
    })
  })

  test('accepts the to form and surrounding spaces', () => {
    expect(parsePeriodRange('  2026-07-01 to 2026-09-15 ')).toEqual({
      start: '2026-07-01',
      end: '2026-09-15',
    })
  })

  test('ignores named periods and open ends', () => {
    expect(parsePeriodRange('2026-Q3')).toBeNull()
    expect(parsePeriodRange('2026-07-01 -')).toBeNull()
    expect(parsePeriodRange('')).toBeNull()
  })
})

describe('formatPeriodLabel ranges', () => {
  test('shows both days instead of a raw token', () => {
    const t = tFor(en as Catalog, 'en')
    expect(formatPeriodLabel('2026-07-01 - 2026-09-15', t)).toBe('2026-07-01 – 2026-09-15')
  })
})
