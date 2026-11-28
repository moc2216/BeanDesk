import { Archive, Banknote, BookOpen, ChartPie, FileSpreadsheet, Landmark, Scale, Terminal } from 'lucide-react'
import type { ComponentType } from 'react'

import { lazyPage } from '@/components/lazy-page'
import type { MessageKey } from '@/i18n/locales/en'

const TrialBalance = lazyPage(() =>
  import('@/pages/TrialBalance').then((m) => ({ default: m.TrialBalance })),
)
const BalanceSheet = lazyPage(() =>
  import('@/pages/BalanceSheet').then((m) => ({ default: m.BalanceSheet })),
)
const IncomeStatement = lazyPage(() =>
  import('@/pages/IncomeStatement').then((m) => ({ default: m.IncomeStatement })),
)
const CashFlow = lazyPage(() =>
  import('@/pages/CashFlow').then((m) => ({ default: m.CashFlow })),
)
const Charts = lazyPage(() =>
  import('@/pages/Charts').then((m) => ({ default: m.Charts })),
)
const Journal = lazyPage(() =>
  import('@/pages/Journal').then((m) => ({ default: m.Journal })),
)
const Documents = lazyPage(() =>
  import('@/pages/Documents').then((m) => ({ default: m.Documents })),
)
const QueryPlayground = lazyPage(() =>
  import('@/pages/QueryPlayground').then((m) => ({ default: m.QueryPlayground })),
)

export const REPORT_PAGES: Array<{
  path: string
  key: MessageKey
  navKey?: MessageKey
  icon: ComponentType<{ className?: string }>
  Page: ComponentType
}> = [
  { path: '/', key: 'trialBalance.title', icon: Scale, Page: TrialBalance },
  { path: '/balance-sheet', key: 'balanceSheet.title', icon: Landmark, Page: BalanceSheet },
  { path: '/income-statement', key: 'income.title', icon: FileSpreadsheet, Page: IncomeStatement },
  { path: '/cash-flow', key: 'cashFlow.title', icon: Banknote, Page: CashFlow },
  { path: '/charts', key: 'charts.title', icon: ChartPie, Page: Charts },
  { path: '/journal', key: 'journal.title', icon: BookOpen, Page: Journal },
  { path: '/documents', key: 'documents.title', navKey: 'documents.nav', icon: Archive, Page: Documents },
  { path: '/query', key: 'query.title', icon: Terminal, Page: QueryPlayground },
]

export function navLabelKey(page: (typeof REPORT_PAGES)[number]): MessageKey {
  return page.navKey ?? page.key
}
