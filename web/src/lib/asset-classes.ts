import type { AccountNode } from './api'

export const ASSET_CLASSES = ['cash', 'fixedIncome', 'equity', 'crypto', 'commodity', 'property', 'other'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

const STORAGE_KEY = 'beandesk.asset-classes'

/** Best-effort default from the account name; the user can override it. */
export function guessAssetClass(account: string, name: string): AssetClass {
  const hay = (account + ' ' + name).toLowerCase()
  if (/(housing ?fund|公积金|押金)/.test(hay)) return 'other'
  if (/(crypto|加密|btc|eth|usdt|web3)/.test(hay)) return 'crypto'
  if (/(gold|黄金|积存|silver|白银|commodity|商品)/.test(hay)) return 'commodity'
  if (/(bond|债券|债|固收|fixed.?income)/.test(hay)) return 'fixedIncome'
  if (/(broker|证券|stock|股票|fund|基金|etf|投资|equity)/.test(hay)) return 'equity'
  if (/(fixed|固定资产|property|房产|物业|房屋)/.test(hay)) return 'property'
  if (/(bank|银行|现金|cash|deposit|押金|储蓄|goal)/.test(hay)) return 'cash'
  return 'other'
}

export function loadClassMap(): Record<string, AssetClass> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, AssetClass> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && (ASSET_CLASSES as readonly string[]).includes(value)) {
        out[key] = value as AssetClass
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveClassMap(map: Record<string, AssetClass>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function classOf(
  node: AccountNode,
  map: Record<string, AssetClass>,
): AssetClass {
  return map[node.account] ?? guessAssetClass(node.account, node.name)
}
