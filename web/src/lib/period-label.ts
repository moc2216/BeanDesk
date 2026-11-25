import type { Vars } from '@/i18n/catalog'
import type { MessageKey } from '@/i18n/locales/en'

import { periodParts } from './ledger-model'

/** Parse Fava's "start - end" range. Days are inclusive. */
export function parsePeriodRange(value: string): { start: string; end: string } | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(?:-|to)\s*(\d{4}-\d{2}-\d{2})$/i)
  return match ? { start: match[1], end: match[2] } : null
}

export function formatPeriodLabel(
  time: string,
  t: (key: MessageKey, vars?: Vars) => string,
): string {
  if (!time) return t('time.allTime')
  const range = time.split(/\s+(?:-|to)\s+/i)
  if (range.length === 2) return range[0] + ' – ' + range[1]
  const parts = periodParts(time)
  if (!parts) return time
  if (parts.kind === 'year') return t('time.periodYear', { year: parts.year })
  if (parts.kind === 'quarter') {
    return t('time.periodQuarter', { year: parts.year, quarter: parts.quarter })
  }
  return t('time.periodMonth', { year: parts.year, month: parts.month })
}
