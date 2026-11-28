import { invoke, isTauri } from '@tauri-apps/api/core'

/** Write a short startup milestone to the console and the desktop log. */
export function logStartup(stage: string): void {
  if (typeof performance === 'undefined') return
  // performance.now() is measured from the navigation start, not from this module.
  const ms = Math.round(performance.now())
  try {
    performance.mark(`beandesk:${stage}`)
  } catch {
    // A duplicate mark must not break the boot path.
  }
  console.info(`[startup] ${stage}: ${ms}ms`)
  if (isTauri()) {
    void invoke('plugin:log|log', { level: 3, message: `startup ${stage} ${ms}ms` }).catch(
      () => undefined,
    )
  }
}
