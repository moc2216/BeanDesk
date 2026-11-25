import { runBQLQuery } from './api'
import { favaClient } from './fava-client'
import { quoteCommodity, readInventory } from './ledger-model'

/** One calendar month, keyed as 'YYYY-MM'. */
export interface MonthPoint {
  key: string
  year: number
  month: number
  label: string
}

export interface CashflowPoint extends MonthPoint {
  income: number
  expense: number
  left: number
}

export interface SavingsPoint extends MonthPoint {
  /** Share of income kept. null when the month had no income. */
  value: number | null
}

export interface NetWorthPoint extends MonthPoint {
  value: number
}

export interface CompositionPoint {
  key: string
  label: string
  values: number[]
}

export interface PayeeSlice {
  name: string
  value: number
}

export interface ChartData {
  cashflow: CashflowPoint[]
  savings: SavingsPoint[]
  netWorth: NetWorthPoint[]
  composition: { categories: string[]; points: CompositionPoint[]; merged: number }
  payees: PayeeSlice[]
}

export function monthKey(year: number, month: number): string {
  return String(year) + '-' + String(month).padStart(2, '0')
}

export function monthLabel(year: number, month: number): string {
  return String(year).slice(2) + '-' + String(month).padStart(2, '0')
}

function pointFromKey(key: string): MonthPoint {
  const [year, month] = key.split('-').map(Number)
  return { key, year, month, label: monthLabel(year, month) }
}

/** Group the per-account monthly rows into one income/expense total per month. */
export function buildCashflow(rows: unknown[][], currency: string): CashflowPoint[] {
  const totals = new Map<string, { income: number; expense: number }>()
  for (const row of rows) {
    const [year, month, account, inventory] = row
    if (typeof year !== 'number' || typeof month !== 'number' || typeof account !== 'string') continue
    const amount = readInventory(inventory, currency).amount
    if (amount === 0) continue
    const key = monthKey(year, month)
    const bucket = totals.get(key) ?? { income: 0, expense: 0 }
    if (account.startsWith('Income:')) bucket.income += amount
    else if (account.startsWith('Expenses:')) bucket.expense += amount
    else continue
    totals.set(key, bucket)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, sums]) => {
      const income = Math.abs(sums.income)
      const expense = Math.abs(sums.expense)
      return { ...pointFromKey(key), income, expense, left: income - expense }
    })
}

/** Insert empty months so a line chart keeps an even time axis. */
export function fillCashflowGaps(points: CashflowPoint[]): CashflowPoint[] {
  if (points.length === 0) return []
  const byKey = new Map(points.map((point) => [point.key, point]))
  const first = points[0]
  const last = points[points.length - 1]
  const filled: CashflowPoint[] = []
  let year = first.year
  let month = first.month
  while (year < last.year || (year === last.year && month <= last.month)) {
    const key = monthKey(year, month)
    filled.push(byKey.get(key) ?? { ...pointFromKey(key), income: 0, expense: 0, left: 0 })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return filled
}

export function buildSavings(points: CashflowPoint[]): SavingsPoint[] {
  return points.map((point) => ({
    ...pointFromKey(point.key),
    value: point.income > 0 ? point.left / point.income : null,
  }))
}

const COMPOSITION_TOP = 5

/** Expenses per class per month, top classes kept and the rest merged. */
export function buildComposition(
  rows: unknown[][],
  currency: string,
  otherLabel: string,
  axis: string[] = [],
): { categories: string[]; points: CompositionPoint[]; merged: number } {
  const byMonth = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const [year, month, account, inventory] = row
    if (typeof year !== 'number' || typeof month !== 'number' || typeof account !== 'string') continue
    if (!account.startsWith('Expenses:')) continue
    const amount = Math.abs(readInventory(inventory, currency).amount)
    if (amount === 0) continue
    const category = account.split(':')[1] || account
    const key = monthKey(year, month)
    const bucket = byMonth.get(key) ?? new Map<string, number>()
    bucket.set(category, (bucket.get(category) ?? 0) + amount)
    byMonth.set(key, bucket)
  }

  const totals = new Map<string, number>()
  for (const bucket of byMonth.values()) {
    for (const [category, value] of bucket) totals.set(category, (totals.get(category) ?? 0) + value)
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const kept = ranked.slice(0, COMPOSITION_TOP).map(([category]) => category)
  const categories = [...kept]
  if (ranked.length > COMPOSITION_TOP) categories.push(otherLabel)

  const keys = axis.length > 0 ? axis : [...byMonth.keys()].sort((a, b) => a.localeCompare(b))
  const points = keys.map((key) => {
    const bucket = byMonth.get(key) ?? new Map<string, number>()
    const values = kept.map((category) => bucket.get(category) ?? 0)
    if (ranked.length > COMPOSITION_TOP) {
      let rest = 0
      for (const [category, value] of bucket) {
        if (!kept.includes(category)) rest += value
      }
      values.push(rest)
    }
    return { ...pointFromKey(key), values }
  })

  return { categories, points, merged: Math.max(0, ranked.length - COMPOSITION_TOP) }
}

/** Largest expense totals per payee. Rows come from a GROUP BY payee query. */
export function buildPayees(rows: unknown[][], currency: string, limit = 10): PayeeSlice[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const [payee, inventory] = row
    if (typeof payee !== 'string') continue
    const name = payee.trim()
    if (!name) continue
    const amount = Math.abs(readInventory(inventory, currency).amount)
    if (amount === 0) continue
    totals.set(name, (totals.get(name) ?? 0) + amount)
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/**
 * Fava ships a monthly net-worth series with the balance sheet. With a
 * conversion requested, each point is already in the operating currency.
 */
export function buildNetWorth(report: unknown, currency: string): NetWorthPoint[] {
  const charts = (report as { charts?: Array<{ type?: string; data?: Array<{ date?: string; balance?: unknown }> }> })
    ?.charts
  const series = charts?.find((chart) => chart.type === 'balances')?.data ?? []
  const points: NetWorthPoint[] = []
  for (const entry of series) {
    const date = entry?.date
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const month = pointFromKey(date.slice(0, 7))
    points.push({ ...month, value: readInventory(entry.balance, currency).amount })
  }
  return points
}

function commodityLiteral(currency: string): string {
  return '"' + quoteCommodity(currency) + '"'
}

export function monthlyRowsQuery(currency: string): string {
  const code = commodityLiteral(currency)
  return (
    'SELECT year, month, account, sum(convert(position, ' +
    code +
    ')) WHERE account ~ "^(Income|Expenses):" GROUP BY year, month, account ORDER BY year, month'
  )
}

export function payeeRowsQuery(currency: string): string {
  const code = commodityLiteral(currency)
  return (
    'SELECT payee, sum(convert(position, ' +
    code +
    ')) WHERE account ~ "^Expenses:" AND payee != "" GROUP BY payee ORDER BY 2 DESC LIMIT 12'
  )
}

export async function fetchChartData(
  currency: string,
  otherLabel: string,
  time?: string,
  signal?: AbortSignal,
): Promise<ChartData> {
  const [flows, payees, report] = await Promise.all([
    runBQLQuery(monthlyRowsQuery(currency), time, signal),
    runBQLQuery(payeeRowsQuery(currency), time, signal),
    favaClient.getBalanceSheet(time, currency, signal),
  ])
  const cashflow = fillCashflowGaps(buildCashflow(flows.rows ?? [], currency))
  const axis = cashflow.map((point) => point.key)
  return {
    cashflow,
    savings: buildSavings(cashflow),
    netWorth: buildNetWorth(report, currency),
    composition: buildComposition(flows.rows ?? [], currency, otherLabel, axis),
    payees: buildPayees(payees.rows ?? [], currency),
  }
}
