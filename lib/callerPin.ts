import { timingSafeEqual } from 'node:crypto'

/** Returns the configured Caller PIN, or null when CALLER_PIN is unset. Never ships a default. */
export function configuredCallerPin(): string | null {
  const fromEnv = process.env.CALLER_PIN?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : null
}

export function pinMatches(presented: string | null | undefined): boolean {
  const expected = configuredCallerPin()
  if (!expected) return false
  const got = presented?.trim() ?? ''
  if (!got) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
