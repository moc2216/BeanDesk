import type { AccountNode } from './api'

export interface PortfolioSlice {
  name: string
  value: number
  children: PortfolioSlice[]
}

/** Two rings at most, like a portfolio sunburst: class, then holdings. */
export function buildPortfolio(
  nodes: AccountNode[],
  format: (account: string) => string,
  depth = 2,
): PortfolioSlice[] {
  return nodes
    .filter((node) => Math.abs(node.total) > 0.005)
    .map((node) => ({
      name: format(node.name),
      value: Math.abs(node.total),
      children: depth > 1 ? buildPortfolio(node.children, format, depth - 1) : [],
    }))
    .sort((a, b) => b.value - a.value)
}

export function portfolioTotal(slices: PortfolioSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0)
}

/** Whole numbers above 10%, one decimal below, so small slices stay readable. */
export function formatShare(value: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (value / total) * 100
  return (pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)) + '%'
}
