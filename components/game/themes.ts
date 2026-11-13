export const THEME_COLORS = ['green', 'blue', 'yellow', 'red', 'purple'] as const

export type ThemeColor = (typeof THEME_COLORS)[number]

export const THEME_LABELS: Record<ThemeColor, string> = {
  green: 'Green',
  blue: 'Blue',
  yellow: 'Yellow',
  red: 'Red',
  purple: 'Purple',
}

export function parseThemeColor(raw: unknown): ThemeColor {
  if (typeof raw === 'string' && (THEME_COLORS as readonly string[]).includes(raw)) {
    return raw as ThemeColor
  }
  return 'green'
}
