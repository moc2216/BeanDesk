import { describe, expect, test } from 'bun:test'

import type { AccountNode } from './api'
import { classOf, guessAssetClass } from './asset-classes'

function node(account: string, name: string): AccountNode {
  return { account, name, total: 1, children: [], label_key: null }
}

describe('guessAssetClass', () => {
  test('reads Chinese and English account names', () => {
    expect(guessAssetClass('Assets:Bank-银行存款', 'Bank-银行存款')).toBe('cash')
    expect(guessAssetClass('Assets:Broker-证券账户', 'Broker-证券账户')).toBe('equity')
    expect(guessAssetClass('Assets:Crypto-加密货币', 'Crypto-加密货币')).toBe('crypto')
    expect(guessAssetClass('Assets:Gold-黄金', 'Gold-黄金')).toBe('commodity')
    expect(guessAssetClass('Assets:Fixed-固定资产', 'Fixed-固定资产')).toBe('property')
    expect(guessAssetClass('Assets:Bond-债券', 'Bond-债券')).toBe('fixedIncome')
    expect(guessAssetClass('Assets:HousingFund-住房公积金', 'HousingFund-住房公积金')).toBe('other')
    expect(guessAssetClass('Assets:Deposit-押金', 'Deposit-押金')).toBe('other')
  })

  test('crypto wins over the fund keyword', () => {
    expect(guessAssetClass('Assets:Crypto-Fund', 'Crypto-Fund')).toBe('crypto')
  })
})

describe('classOf', () => {
  test('a saved mapping overrides the guess', () => {
    const map = { 'Assets:Broker-证券账户': 'cash' as const }
    expect(classOf(node('Assets:Broker-证券账户', 'Broker-证券账户'), map)).toBe('cash')
  })
})
