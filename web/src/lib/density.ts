export type Density = 'comfortable' | 'compact'

const KEY = 'beancount-density'

export function loadDensity(): Density {
  try {
    return window.localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export function applyDensity(value: Density): void {
  document.documentElement.dataset.density = value
}

export function saveDensity(value: Density): void {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    // ignore
  }
  applyDensity(value)
}
