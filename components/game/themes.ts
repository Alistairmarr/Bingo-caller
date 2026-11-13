export const THEME_COLORS = ['yellow', 'red', 'lilac', 'brown', 'pink', 'green'] as const

export type ThemeColor = (typeof THEME_COLORS)[number]

export const THEME_LABELS: Record<ThemeColor, string> = {
  yellow: 'Yellow',
  red: 'Red',
  lilac: 'Lilac',
  brown: 'Brown',
  pink: 'Pink',
  green: 'Green',
}

/** Accept current colours plus a couple of old theme ids from earlier builds. */
export function parseThemeColor(raw: unknown): ThemeColor {
  if (typeof raw !== 'string') return 'green'
  if ((THEME_COLORS as readonly string[]).includes(raw)) return raw as ThemeColor
  if (raw === 'blue' || raw === 'purple') return raw === 'blue' ? 'lilac' : 'pink'
  return 'green'
}
