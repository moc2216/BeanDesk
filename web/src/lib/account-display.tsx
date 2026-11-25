import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { displayAccountName } from './format'

/** How account names are rendered: the Chinese label or the Beancount path. */
export type AccountDisplayMode = 'localized' | 'raw'

const STORAGE_KEY = 'beandesk.account-display'

interface AccountDisplayValue {
  mode: AccountDisplayMode
  setMode: (mode: AccountDisplayMode) => void
  /** Display name for UI text. raw keeps the full Beancount account path. */
  format: (account: string) => string
}

const AccountDisplayContext = createContext<AccountDisplayValue | null>(null)

function storedMode(): AccountDisplayMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'raw' ? 'raw' : 'localized'
  } catch {
    return 'localized'
  }
}

export function AccountDisplayProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AccountDisplayMode>(storedMode)
  const setMode = useCallback((next: AccountDisplayMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing / storage disabled - the choice stays for this session.
    }
  }, [])
  const value = useMemo<AccountDisplayValue>(
    () => ({
      mode,
      setMode,
      format: (account: string) => (mode === 'raw' ? account : displayAccountName(account)),
    }),
    [mode, setMode],
  )
  return <AccountDisplayContext.Provider value={value}>{children}</AccountDisplayContext.Provider>
}

export function useAccountDisplay(): AccountDisplayValue {
  const value = useContext(AccountDisplayContext)
  if (!value) throw new Error('useAccountDisplay must be used inside <AccountDisplayProvider>')
  return value
}
