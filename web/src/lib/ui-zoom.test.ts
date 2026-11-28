import { describe, expect, test } from 'bun:test'

import { clampUiZoom, UI_ZOOM_MAX, UI_ZOOM_MIN } from './ui-zoom'

describe('clampUiZoom', () => {
  test('keeps the configured range', () => {
    expect(clampUiZoom(0.5)).toBe(UI_ZOOM_MIN)
    expect(clampUiZoom(3)).toBe(UI_ZOOM_MAX)
    expect(clampUiZoom(1.04)).toBe(1)
    expect(clampUiZoom(1.06)).toBe(1.1)
  })

  test('falls back to 100% for invalid input', () => {
    expect(clampUiZoom(Number.NaN)).toBe(1)
    expect(clampUiZoom(Number.POSITIVE_INFINITY)).toBe(1)
  })
})
