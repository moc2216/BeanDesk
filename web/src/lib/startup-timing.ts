import { invoke, isTauri } from '@tauri-apps/api/core'

const startedAt = typeof performance === 'undefined' ? 0 : performance.now()

/** Write a short startup milestone to the console and the desktop log. */
export function logStartup(stage: string): void {
  if (typeof performance === 'undefined') return
  const ms = Math.round(performance.now() - startedAt)
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
