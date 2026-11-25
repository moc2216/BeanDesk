const ACCOUNTS_KEY = 'beandesk.portfolio.accounts'
const TARGETS_KEY = 'beandesk.portfolio.targets'

export function loadAccounts(): string[] | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null
  } catch {
    return null
  }
}

export function saveAccounts(accounts: string[]): void {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    // Storage disabled: the page still works for this session.
  }
}

export function loadTargets(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(TARGETS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function saveTargets(targets: Record<string, number>): void {
  try {
    window.localStorage.setItem(TARGETS_KEY, JSON.stringify(targets))
  } catch {
    // ignore
  }
}
