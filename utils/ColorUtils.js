/**
 * utils/ColorUtils.js — a real, small, shared helper
 *
 * Extracted from utils/ToolTipSettings.js's own private version,
 * since ToolTipNodeOverrides needed the exact same conversion —
 * one real implementation, not two independently-maintained copies.
 */

export function hexToRgba (hex, alpha) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
