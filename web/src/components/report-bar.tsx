import type { ReactNode } from 'react'

import { useI18n } from '@/i18n'
import { formatPeriodLabel } from '@/lib/period-label'
import { useTimeFilter } from '@/lib/time-context'

/** The accounting period that every figure on the page respects. */
function PeriodNote() {
  const { t } = useI18n()
  const { timeFilter, isAllTime } = useTimeFilter()
  return (
    <p className="text-xs text-muted-foreground">
      {t('charts.filterPeriod')} ·{' '}
      {isAllTime ? t('time.allTime') : formatPeriodLabel(timeFilter, t)}
      <span aria-hidden className="px-2">·</span>
    </p>
  )
}

/** Status on the left, actions on the right. */
export function ReportBar({ status, actions }: { status: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodNote />
        {status}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

/** When the figures are from, plus the currency. Not a status chip. */
export function ReportWhen({
  currency,
  children,
}: {
  currency: string
  children?: ReactNode
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {children ? (
        <>
          {children}
          <span aria-hidden> · </span>
        </>
      ) : null}
      <span>{currency}</span>
    </p>
  )
}

export function ReportDay({ iso, children }: { iso: string; children: ReactNode }) {
  return <time dateTime={iso}>{children}</time>
}
