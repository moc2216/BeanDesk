import type { pinyin as pinyinType } from 'pinyin-pro'

type PinyinFn = typeof pinyinType

const CJK = /[\u4e00-\u9fff]/
const cache = new Map<string, string>()
const listeners = new Set<() => void>()

let pinyin: PinyinFn | null = null
let loading: Promise<void> | null = null

/** True once the optional pinyin lookup has been loaded. */
export function accountSearchReady(): boolean {
  return pinyin !== null
}

/** Notify the search UI when pinyin becomes available. */
export function subscribeAccountSearch(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Load pinyin only when the account search is focused. Until it arrives the
 * raw account path and leaf name still match, so the first paint stays small.
 */
export function loadAccountSearch(): Promise<void> {
  if (pinyin) return Promise.resolve()
  if (loading) return loading
  loading = import('pinyin-pro')
    .then(({ pinyin: loaded }) => {
      pinyin = loaded
      cache.clear()
      for (const listener of listeners) listener()
    })
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
}

/**
 * Lower-cased text used by account filters: the raw path, the leaf name, and
 * pinyin for the Chinese segments so zscx / zhaoshang find 招商储蓄.
 */
export function accountHaystack(account: string, leaf: string): string {
  const base = (account + ' ' + leaf).toLowerCase()
  if (!CJK.test(account) || !pinyin) return base
  const cached = cache.get(account)
  if (cached) return cached
  const segments = account.split(':')
  const full = segments
    .map((segment) => pinyin!(segment, { toneType: 'none', type: 'array' }).join(''))
    .join(' ')
  const initials = segments
    .map((segment) => pinyin!(segment, { pattern: 'first', toneType: 'none', type: 'array' }).join(''))
    .join(' ')
  const value = base + ' ' + full + ' ' + initials
  cache.set(account, value)
  return value
}
