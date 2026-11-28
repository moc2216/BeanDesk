import { useEffect } from 'react'

import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import {
  applyUiZoom,
  getUiZoom,
  setUiZoom,
  stepUiZoom,
  syncUiZoom,
  UI_ZOOM_STEP,
  UI_ZOOM_STORAGE_KEY,
} from '@/lib/ui-zoom'

/** Applies the stored zoom, follows the native View menu, and keeps windows in sync. */
export function UiZoomController() {
  useEffect(() => {
    void applyUiZoom(getUiZoom())

    const onStorage = (event: StorageEvent) => {
      if (event.key === UI_ZOOM_STORAGE_KEY) syncUiZoom()
    }
    window.addEventListener('storage', onStorage)

    let stop: (() => void) | undefined
    let disposed = false

    // macOS/Linux use the native menu accelerators. Windows has no native
    // menu bar, so handle the same shortcuts in the webview.
    const isWindows = navigator.userAgent.includes('Windows')
    const usesNativeMenu = isTauri() && !isWindows

    if (usesNativeMenu) {
      void listen<string>('ui-zoom', (event) => {
        if (event.payload === 'in') stepUiZoom(UI_ZOOM_STEP)
        else if (event.payload === 'out') stepUiZoom(-UI_ZOOM_STEP)
        else if (event.payload === 'reset') setUiZoom(1)
      }).then((unlisten) => {
        if (disposed) unlisten()
        else stop = unlisten
      })
    } else {
      const onKey = (event: KeyboardEvent) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return
        if (event.key === '=' || event.key === '+') {
          event.preventDefault()
          stepUiZoom(UI_ZOOM_STEP)
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault()
          stepUiZoom(-UI_ZOOM_STEP)
        } else if (event.key === '0') {
          event.preventDefault()
          setUiZoom(1)
        }
      }
      window.addEventListener('keydown', onKey)
      stop = () => window.removeEventListener('keydown', onKey)
    }

    return () => {
      disposed = true
      window.removeEventListener('storage', onStorage)
      stop?.()
    }
  }, [])

  return null
}
