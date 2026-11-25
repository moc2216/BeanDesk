import { pinyin } from 'pinyin-pro'

const CJK = /[\u4e00-\u9fff]/
const cache = new Map<string, string>()

/**
 * Lower-cased text used by account filters: the raw path, the leaf name, and
 * pinyin for the Chinese segments so zscx / zhaoshang find 招商储蓄.
 */
export function accountHaystack(account: string, leaf: string): string {
  const base = (account + ' ' + leaf).toLowerCase()
  if (!CJK.test(account)) return base
  const cached = cache.get(account)
  if (cached) return cached
  const segments = account.split(':')
  const full = segments
    .map((segment) => pinyin(segment, { toneType: 'none', type: 'array' }).join(''))
    .join(' ')
  const initials = segments
    .map((segment) => pinyin(segment, { pattern: 'first', toneType: 'none', type: 'array' }).join(''))
    .join(' ')
  const value = base + ' ' + full + ' ' + initials
  cache.set(account, value)
  return value
}
