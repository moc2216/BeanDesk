import { cn } from '@/lib/utils'

export type SummaryCell = {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}

/** Report header strip: one surface, hairline dividers, tabular figures. */
export function ReportSummary({ cells }: { cells: SummaryCell[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn(
            'px-5 py-4',
            index > 0 && 'border-l border-border',
            index === 2 && 'max-lg:border-t max-lg:border-l-0',
            index === 3 && 'max-lg:border-t',
          )}
        >
          <div className="text-[11px] text-muted-foreground">{cell.label}</div>
          <div
            className={cn(
              'mt-1 text-[20px] font-semibold tracking-tight tabular-nums',
              cell.tone === 'positive' && 'text-positive',
              cell.tone === 'negative' && 'text-destructive',
            )}
          >
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  )
}
