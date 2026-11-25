import { describe, expect, test } from 'bun:test'

import {
  buildCashflow,
  buildComposition,
  buildNetWorth,
  buildPayees,
  buildSavings,
  fillCashflowGaps,
  monthKey,
  monthlyRowsQuery,
  payeeRowsQuery,
} from './chart-series'

describe('monthKey', () => {
  test('pads single-digit months', () => {
    expect(monthKey(2025, 1)).toBe('2025-01')
    expect(monthKey(2026, 11)).toBe('2026-11')
  })
})

describe('buildCashflow', () => {
  test('groups income and expenses per month with signs removed', () => {
    const rows = [
      [2025, 1, 'Income:Salary-工资', { CNY: -35000 }],
      [2025, 1, 'Income:Interest-利息', { CNY: -50 }],
      [2025, 1, 'Expenses:Housing-居住', { CNY: 4500 }],
      [2025, 2, 'Expenses:Food-餐饮', { CNY: 800 }],
    ]
    expect(buildCashflow(rows, 'CNY')).toEqual([
      { key: '2025-01', year: 2025, month: 1, label: '25-01', income: 35050, expense: 4500, left: 30550 },
      { key: '2025-02', year: 2025, month: 2, label: '25-02', income: 0, expense: 800, left: -800 },
    ])
  })

  test('ignores other currencies instead of mixing them in', () => {
    const rows = [
      [2025, 1, 'Expenses:Food-餐饮', { CNY: 100 }],
      [2025, 1, 'Expenses:Travel-旅行', { USD: 50 }],
    ]
    expect(buildCashflow(rows, 'CNY')[0].expense).toBe(100)
  })

  test('drops rows that do not belong to income or expenses', () => {
    const rows = [[2025, 1, 'Assets:Bank-银行', { CNY: 100 }]]
    expect(buildCashflow(rows, 'CNY')).toEqual([])
  })
})

describe('fillCashflowGaps', () => {
  test('inserts zero months between the first and last point', () => {
    const points = buildCashflow(
      [
        [2025, 1, 'Expenses:A', { CNY: 100 }],
        [2025, 4, 'Expenses:A', { CNY: 200 }],
      ],
      'CNY',
    )
    const filled = fillCashflowGaps(points)
    expect(filled.map((point) => point.key)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04'])
    expect(filled[1]).toMatchObject({ income: 0, expense: 0, left: 0 })
  })

  test('crosses a year boundary', () => {
    const points = buildCashflow(
      [
        [2025, 11, 'Expenses:A', { CNY: 1 }],
        [2026, 2, 'Expenses:A', { CNY: 2 }],
      ],
      'CNY',
    )
    expect(fillCashflowGaps(points).map((point) => point.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  test('returns an empty list for no data', () => {
    expect(fillCashflowGaps([])).toEqual([])
  })
})

describe('buildSavings', () => {
  test('computes the share kept and leaves empty months open', () => {
    const points = buildCashflow(
      [
        [2025, 1, 'Income:Salary', { CNY: -1000 }],
        [2025, 1, 'Expenses:Food', { CNY: 250 }],
        [2025, 2, 'Expenses:Food', { CNY: 100 }],
      ],
      'CNY',
    )
    const filled = fillCashflowGaps(points)
    expect(buildSavings(filled).map((point) => point.value)).toEqual([0.75, null])
  })
})

describe('buildComposition', () => {
  test('keeps the five largest classes and merges the rest', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map((name, index) => [
      2025,
      1,
      'Expenses:' + name + '-类',
      { CNY: (index + 1) * 100 },
    ])
    const result = buildComposition(rows, 'CNY', '其他', ['2025-01'])
    expect(result.categories).toEqual(['F-类', 'E-类', 'D-类', 'C-类', 'B-类', '其他'])
    expect(result.points[0].values).toEqual([600, 500, 400, 300, 200, 100])
  })

  test('aligns to the given axis and fills missing months with zero', () => {
    const rows = [[2025, 2, 'Expenses:Food-餐饮', { CNY: 300 }]]
    const result = buildComposition(rows, 'CNY', '其他', ['2025-01', '2025-02'])
    expect(result.points.map((point) => point.values)).toEqual([[0], [300]])
  })

  test('skips income rows', () => {
    const rows = [[2025, 1, 'Income:Salary', { CNY: -1000 }]]
    expect(buildComposition(rows, 'CNY', '其他').points).toEqual([])
  })
})

describe('buildPayees', () => {
  test('sorts by total, merges duplicates and limits the list', () => {
    const rows = [
      ['房东', { CNY: 4500 }],
      ['超市', { CNY: 300 }],
      ['房东', { CNY: 4500 }],
      ['', { CNY: 999 }],
      [null, { CNY: 999 }],
    ]
    expect(buildPayees(rows, 'CNY', 2)).toEqual([
      { name: '房东', value: 9000 },
      { name: '超市', value: 300 },
    ])
  })
})

describe('buildNetWorth', () => {
  test('reads the monthly balance series in the operating currency', () => {
    const report = {
      charts: [
        {
          type: 'balances',
          data: [
            { date: '2025-01-31', balance: { CNY: -546353.42 } },
            { date: '2026-11-30', balance: { CNY: 77105.82 } },
          ],
        },
      ],
    }
    expect(buildNetWorth(report, 'CNY')).toEqual([
      { key: '2025-01', year: 2025, month: 1, label: '25-01', value: -546353.42 },
      { key: '2026-11', year: 2026, month: 11, label: '26-11', value: 77105.82 },
    ])
  })

  test('tolerates a report without charts', () => {
    expect(buildNetWorth({}, 'CNY')).toEqual([])
    expect(buildNetWorth(null, 'CNY')).toEqual([])
  })
})

describe('queries', () => {
  test('quote the operating currency', () => {
    expect(monthlyRowsQuery('CNY')).toContain('convert(position, "CNY")')
    expect(payeeRowsQuery('USD')).toContain('convert(position, "USD")')
  })

  test('reject a currency code that would break the query', () => {
    expect(() => monthlyRowsQuery('CNY"; DROP')).toThrow()
  })
})
