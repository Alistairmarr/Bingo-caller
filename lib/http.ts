import { NextResponse } from 'next/server'

const MAX_JSON_BYTES = 8_192
const WINDOW_MS = 60_000
const MAX_BUCKETS = 16
/**
 * Separate named buckets so Display GET flood cannot exhaust Caller claim/PUT.
 * Never keyed by client IP / forwarded headers.
 */
const BUCKET_LIMITS: Record<string, number> = {
  'rooms-read': 6_000, // Display phones poll ~1–2/s
  'rooms-claim': 60, // POST mint / reclaim (PIN)
  'rooms-write': 240, // Caller PUT updates
}

type Bucket = { resetAt: number; hits: number }

type GlobalLimit = typeof globalThis & {
  __ancrumBingoRate?: Map<string, Bucket>
}

function rateMap(): Map<string, Bucket> {
  const g = globalThis as GlobalLimit
  g.__ancrumBingoRate ??= new Map()
  return g.__ancrumBingoRate
}

function pruneRateMap(now: number) {
  const map = rateMap()
  for (const [key, entry] of map) {
    if (entry.resetAt <= now) map.delete(key)
  }
  while (map.size > MAX_BUCKETS) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

/**
 * Per-route bucket rate limit (no forwarded-header identity).
 */
export function rateLimit(_request: Request, bucket: keyof typeof BUCKET_LIMITS): NextResponse | null {
  const now = Date.now()
  pruneRateMap(now)
  const map = rateMap()
  const key = `bucket:${bucket}`
  const maxHits = BUCKET_LIMITS[bucket]
  let entry = map.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { resetAt: now + WINDOW_MS, hits: 0 }
    map.set(key, entry)
  }
  entry.hits += 1
  if (entry.hits > maxHits) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  return null
}

export async function readJsonBody(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: 'body_too_large' }, { status: 413 }) }
  }
  const buf = await request.arrayBuffer()
  if (buf.byteLength > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: 'body_too_large' }, { status: 413 }) }
  }
  if (buf.byteLength === 0) return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8').decode(buf)) as unknown }
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  }
}

export function readCallerToken(request: Request, body?: unknown): string | null {
  const header =
    request.headers.get('x-caller-token')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''
  if (header) return header
  if (body && typeof body === 'object' && body !== null && 'callerToken' in body) {
    const token = (body as { callerToken?: unknown }).callerToken
    if (typeof token === 'string' && token.trim()) return token.trim()
  }
  return null
}

export function readCallerPin(request: Request, body?: unknown): string | null {
  const header = request.headers.get('x-caller-pin')?.trim() || ''
  if (header) return header
  if (body && typeof body === 'object' && body !== null && 'callerPin' in body) {
    const pin = (body as { callerPin?: unknown }).callerPin
    if (typeof pin === 'string' && pin.trim()) return pin.trim()
  }
  return null
}
