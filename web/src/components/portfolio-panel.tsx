import * as echarts from 'echarts'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Chart } from '@/components/echart'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { useAccountDisplay } from '@/lib/account-display'
import type { AccountNode } from '@/lib/api'
import { buildPortfolio, formatShare, portfolioTotal } from '@/lib/portfolio'
import { cn } from '@/lib/utils'

const COLORS = ['#4f8cff', '#f06a9b', '#ffc53d', '#35c8d8', '#f4765a', '#7c6cf0', '#35c88a', '#b08968']

export function PortfolioPanel({ nodes, currency }: { nodes: AccountNode[]; currency: string }) {
  const { t, formatCurrency } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const [scope, setScope] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const scoped = scope ? nodes.find((node) => node.account === scope) : null
  const slices = useMemo(
    () => buildPortfolio(scoped ? scoped.children : nodes, formatAccount),
    [nodes, scoped, formatAccount],
  )
  const total = portfolioTotal(slices)
  const holdings = slices.reduce((sum, slice) => sum + Math.max(1, slice.children.length), 0)

  const option = useMemo<echarts.EChartsOption>(() => {
    const data = slices.map((slice, index) => ({
      name: slice.name,
      value: slice.value,
      itemStyle: { color: COLORS[index % COLORS.length] },
      label: { show: total > 0 && slice.value / total >= 0.06, rotate: 0 },
      children: slice.children.map((child, childIndex) => ({
        name: child.name,
        value: child.value,
        itemStyle: {
          color: COLORS[index % COLORS.length],
          opacity: Math.max(0.4, 0.9 - childIndex * 0.12),
        },
      })),
    }))
    return {
      tooltip: {
        formatter: (params) => {
          const item = params as { name: string; value: number }
          return item.name + '<br/>' + formatCurrency(item.value, currency) + ' · ' + formatShare(item.value, total)
        },
      },
      series: [
        {
          type: 'sunburst',
          data,
          radius: ['38%', '96%'],
          center: ['50%', '50%'],
          nodeClick: false,
          emphasis: { focus: 'ancestor' },
          itemStyle: { borderColor: 'transparent', borderWidth: 2, borderRadius: 3 },
          label: { fontSize: 10, color: '#fff', rotate: 0 },
          levels: [
            {},
            { r0: '38%', r: '64%', label: { fontSize: 10 } },
            { r0: '64%', r: '96%', label: { show: false } },
          ],
        },
      ],
    }
  }, [slices, total, currency, formatCurrency])

  function toggle(name: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const groups = nodes.filter((node) => node.children.length > 0)
  const scopeLabel = scoped ? formatAccount(scoped.name) : t('charts.scopeAll')

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative">
        <Chart option={option} height={340} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">{t('charts.totalHoldings')}</span>
          <span className="max-w-[70%] truncate text-sm font-semibold tabular-nums">
            {formatCurrency(total, currency)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t('charts.holdingsCount', { count: holdings })}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit">
              {scopeLabel}
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setScope(null)}>
              {t('charts.scopeAll')}
            </DropdownMenuItem>
            {groups.map((node) => (
              <DropdownMenuItem key={node.account} onClick={() => setScope(node.account)}>
                {formatAccount(node.name)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-col">
          {slices.map((slice, index) => {
            const open = expanded.has(slice.name)
            return (
              <div key={slice.name}>
                <button
                  type="button"
                  onClick={() => toggle(slice.name)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    slice.children.length > 0 ? 'hover:bg-muted/60' : 'cursor-default',
                  )}
                  aria-expanded={slice.children.length > 0 ? open : undefined}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{slice.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatShare(slice.value, total)}
                  </span>
                  {slice.children.length > 0 ? (
                    <ChevronDown
                      className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                    />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                </button>
                {open
                  ? slice.children.map((child) => (
                      <div
                        key={child.name}
                        className="flex items-center gap-2 py-1 pl-8 pr-2 text-xs text-muted-foreground"
                      >
                        <span className="min-w-0 flex-1 truncate">{child.name}</span>
                        <span className="tabular-nums">{formatShare(child.value, total)}</span>
                        <span className="w-3.5 shrink-0" />
                      </div>
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
