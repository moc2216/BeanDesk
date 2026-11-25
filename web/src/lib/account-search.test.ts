import { describe, expect, test } from 'bun:test'

import { accountHaystack } from './account-search'

describe('accountHaystack', () => {
  test('keeps the raw path and the leaf name searchable', () => {
    const haystack = accountHaystack('Assets:Bank-银行存款:CMB-招商储蓄', '招商储蓄')
    expect(haystack).toContain('assets:bank-银行存款:cmb-招商储蓄')
    expect(haystack).toContain('招商储蓄')
  })

  test('matches full pinyin and pinyin initials', () => {
    const haystack = accountHaystack('Assets:Bank-银行存款:CMB-招商储蓄', '招商储蓄')
    expect(haystack).toContain('zhaoshangchuxu')
    expect(haystack).toContain('zscx')
  })

  test('matches initials inside a parent segment', () => {
    const haystack = accountHaystack('Expenses:Housing-居住:Rent-房租', 'Rent-房租')
    expect(haystack).toContain('juzhu')
    expect(haystack).toContain('fz')
  })

  test('leaves pure-ASCII accounts unchanged', () => {
    expect(accountHaystack('Assets:Broker-IBKR', 'Broker-IBKR')).toBe('assets:broker-ibkr broker-ibkr')
  })
})
