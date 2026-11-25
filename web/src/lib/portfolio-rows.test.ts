import { describe, expect, test } from 'bun:test'

import type { AccountNode } from './api'
import { guessInvestmentAccounts, portfolioRows } from './portfolio-rows'

function node(account: string, name: string, total: number, children: AccountNode[] = []): AccountNode {
  return { account, name, total, children, label_key: null }
}

const format = (name: string) => name.split('-').pop() ?? name

describe('guessInvestmentAccounts', () => {
  test('keeps securities, funds, crypto and gold, drops daily accounts', () => {
    const nodes = [
      node('Assets:Bank-银行存款', 'Bank-银行存款', 300, [node('Assets:Bank-银行存款:CMB-招商', 'CMB-招商', 300)]),
      node('Assets:Broker-证券账户', 'Broker-证券账户', 200, [node('Assets:Broker-证券账户:Cash-现金', 'Cash-现金', 200)]),
      node('Assets:Crypto-加密资产', 'Crypto-加密资产', 50, [node('Assets:Crypto-加密资产:BTC', 'BTC', 50)]),
      node('Assets:HousingFund-住房公积金', 'HousingFund-住房公积金', 100, [node('Assets:HousingFund-住房公积金:P-个人', 'P-个人', 100)]),
      node('Assets:Gold-黄金', 'Gold-黄金', 5, [node('Assets:Gold-黄金:Au-积存金', 'Au-积存金', 5)]),
    ]
    expect(guessInvestmentAccounts(nodes)).toEqual([
      'Assets:Broker-证券账户',
      'Assets:Crypto-加密资产',
      'Assets:Gold-黄金',
    ])
  })
})

describe('portfolioRows', () => {
  test('computes shares and gaps against the target', () => {
    const nodes = [
      node('Assets:Broker-证券账户', 'Broker-证券账户', 75, [
        node('Assets:Broker-证券账户:Cash-现金', 'Cash-现金', 50),
        node('Assets:Broker-证券账户:ETF-沪深300', 'ETF-沪深300', 25),
      ]),
      node('Assets:Gold-黄金', 'Gold-黄金', 25, []),
    ]
    const rows = portfolioRows(nodes, format, { 'Assets:Broker-证券账户': 30, 'Assets:Gold-黄金': 40 })
    expect(rows[0].name).toBe('证券账户')
    expect(rows[0].share).toBeCloseTo(0.75)
    expect(rows[0].gap).toBeCloseTo(30 - 75)
    expect(rows[1].gap).toBeCloseTo(40 - 25)
    expect(rows[0].children.map((child) => child.name)).toEqual(['现金', '沪深300'])
  })

  test('leaves gap empty when no target is set and ignores empty accounts', () => {
    const rows = portfolioRows([node('Assets:Broker-证券账户', 'Broker-证券账户', 10), node('Assets:X', 'X', 0)], format, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].gap).toBeNull()
    expect(rows[0].target).toBeNull()
  })
})
