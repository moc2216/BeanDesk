import type { AccountNode } from './api'

// Deposit-like accounts stay out: this page is for long-term investments.
const ASCII_HINTS = ['broker', 'invest', 'fund', 'stock', 'bond', 'crypto', 'gold']
const CJK_HINTS = ['投资', '证券', '基金', '股票', '债券', '加密', '黄金', '积存']

/** First-run guess: top-level groups that look like long-term investments. */
export function guessInvestmentAccounts(nodes: AccountNode[]): string[] {
  return nodes
    .filter((node) => node.children.length > 0)
    .filter((node) =>
      node.account
        .split(':')
        .slice(1)
        .some((segment) => {
          const [english, ...rest] = segment.split('-')
          const chinese = rest.join('-')
          return (
            ASCII_HINTS.some((hint) => english.toLowerCase().startsWith(hint)) ||
            CJK_HINTS.some((hint) => chinese.includes(hint))
          )
        }),
    )
    .map((node) => node.account)
}

export interface PortfolioRow {
  account: string
  name: string
  value: number
  share: number
  target: number | null
  /** Positive means still to add, negative means over target. */
  gap: number | null
  children: Array<{ account: string; name: string; value: number; share: number }>
}

export function portfolioRows(
  nodes: AccountNode[],
  format: (account: string) => string,
  targets: Record<string, number>,
): PortfolioRow[] {
  const visible = nodes.filter((node) => Math.abs(node.total) > 0.005)
  const total = visible.reduce((sum, node) => sum + Math.abs(node.total), 0)
  return visible
    .map((node) => {
      const value = Math.abs(node.total)
      const target = targets[node.account] ?? null
      return {
        account: node.account,
        name: format(node.name),
        value,
        share: total > 0 ? value / total : 0,
        target,
        gap: target == null ? null : (target / 100) * total - value,
        children: node.children
          .filter((child) => Math.abs(child.total) > 0.005)
          .map((child) => ({
            account: child.account,
            name: format(child.name),
            value: Math.abs(child.total),
            share: total > 0 ? Math.abs(child.total) / total : 0,
          }))
          .sort((a, b) => b.value - a.value),
      }
    })
    .sort((a, b) => b.value - a.value)
}
