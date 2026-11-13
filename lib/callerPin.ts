import { timingSafeEqual } from 'node:crypto'

/** Local / smoke default when CALLER_PIN is unset. Published apps should set CALLER_PIN. */
export const DEFAULT_CALLER_PIN = 'fete'

export function expectedCallerPin(): string {
  const fromEnv = process.env.CALLER_PIN?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CALLER_PIN
}

export function pinMatches(presented: string | null | undefined): boolean {
  const expected = expectedCallerPin()
  const got = presented?.trim() ?? ''
  if (!got) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
