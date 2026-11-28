import { cn } from '@/lib/utils'

export type SummaryCell = {
  label: string
  value: string
  tone?: 'positive' | 'negative'
  note?: string
  noteTone?: 'positive' | 'negative'
}

/** Report KPI cards: same scale and radius as the Charts page. */
export function ReportSummary({ cells }: { cells: SummaryCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="density-card rounded-2xl border border-border bg-card p-5"
        >
          <div className="text-xs text-muted-foreground">{cell.label}</div>
          <div
            className={cn(
              'mt-2 text-[34px] leading-10 font-semibold tracking-tight tabular-nums',
              cell.tone === 'positive' && 'text-positive',
              cell.tone === 'negative' && 'text-destructive',
            )}
          >
            {cell.value}
          </div>
          {cell.note ? (
            <div
              className={cn(
                'mt-1 text-[11px] tabular-nums',
                cell.noteTone === 'positive' && 'text-positive',
                cell.noteTone === 'negative' && 'text-destructive',
                !cell.noteTone && 'text-muted-foreground',
              )}
            >
              {cell.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
