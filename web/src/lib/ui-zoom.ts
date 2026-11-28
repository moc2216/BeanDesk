import { invoke, isTauri } from '@tauri-apps/api/core'
import { useSyncExternalStore } from 'react'

export const UI_ZOOM_MIN = 0.7
export const UI_ZOOM_MAX = 2.5
export const UI_ZOOM_STEP = 0.1
export const UI_ZOOM_STORAGE_KEY = 'beancount-ui-zoom'

const DEFAULT_ZOOM = 1

export function clampUiZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM
  const stepped = Math.round(value * 10) / 10
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, stepped))
}

function readStored(): number {
  if (typeof window === 'undefined') return DEFAULT_ZOOM
  try {
    return clampUiZoom(Number(window.localStorage.getItem(UI_ZOOM_STORAGE_KEY) ?? DEFAULT_ZOOM))
  } catch {
    return DEFAULT_ZOOM
  }
}

let current = readStored()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function getUiZoom(): number {
  return current
}

export function subscribeUiZoom(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useUiZoom(): number {
  return useSyncExternalStore(subscribeUiZoom, getUiZoom, () => DEFAULT_ZOOM)
}

export async function applyUiZoom(scale: number): Promise<void> {
  if (typeof document === 'undefined') return
  const value = clampUiZoom(scale)
  document.documentElement.dataset.uiZoom = String(value)
  if (isTauri()) {
    try {
      await invoke('set_ui_zoom', { scale: value })
    } catch {
      // The next boot retries from the stored value.
    }
    return
  }
  // Browser preview has no native webview zoom; CSS zoom keeps the layout usable.
  if (value === DEFAULT_ZOOM) {
    document.documentElement.style.removeProperty('zoom')
  } else {
    document.documentElement.style.setProperty('zoom', String(value))
  }
}

export function setUiZoom(scale: number): void {
  const value = clampUiZoom(scale)
  current = value
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(value))
    } catch {
      // Ignore storage failures; the in-memory value still applies.
    }
  }
  void applyUiZoom(value)
  notify()
}

export function stepUiZoom(delta: number): void {
  setUiZoom(current + delta)
}

/** Another window changed the shared value. */
export function syncUiZoom(): void {
  current = readStored()
  void applyUiZoom(current)
  notify()
}
