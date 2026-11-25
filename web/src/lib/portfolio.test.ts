import { describe, expect, test } from 'bun:test'

import type { AccountNode } from './api'
import { buildPortfolio, formatShare, portfolioTotal } from './portfolio'

function node(account: string, name: string, total: number, children: AccountNode[] = []): AccountNode {
  return { account, name, total, children, label_key: null }
}

const format = (name: string) => name.split('-').pop() ?? name

describe('buildPortfolio', () => {
  test('keeps two rings and drops empty accounts', () => {
    const nodes = [
      node('Assets:Broker-证券账户', 'Broker-证券账户', 219, [
        node('Assets:Broker-证券账户:Cash-证券现金', 'Cash-证券现金', 209),
        node('Assets:Broker-证券账户:CSI300-沪深300', 'CSI300-沪深300', 10),
      ]),
      node('Assets:Empty', 'Empty', 0),
    ]
    expect(buildPortfolio(nodes, format)).toEqual([
      {
        name: '证券账户',
        value: 219,
        children: [
          { name: '证券现金', value: 209, children: [] },
          { name: '沪深300', value: 10, children: [] },
        ],
      },
    ])
  })

  test('stops at the requested depth', () => {
    const deep = [node('A', 'A-甲', 1, [node('A:B', 'B-乙', 1, [node('A:B:C', 'C-丙', 1)])])]
    const slices = buildPortfolio(deep, format, 1)
    expect(slices[0].children).toEqual([])
  })

  test('uses absolute values for credit-side accounts', () => {
    expect(buildPortfolio([node('A', 'A-甲', -50)], format)[0].value).toBe(50)
  })
})

describe('portfolioTotal', () => {
  test('sums the visible slices', () => {
    const slices = buildPortfolio([node('A', 'A-甲', 10), node('B', 'B-乙', 32.5)], format)
    expect(portfolioTotal(slices)).toBe(42.5)
  })
})

describe('formatShare', () => {
  test('rounds large shares and keeps one decimal for small ones', () => {
    expect(formatShare(45, 100)).toBe('45%')
    expect(formatShare(7.8, 100)).toBe('7.8%')
    expect(formatShare(2.34, 100)).toBe('2.3%')
    expect(formatShare(1, 0)).toBe('0%')
  })
})
