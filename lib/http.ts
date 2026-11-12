import { NextResponse } from 'next/server'

const MAX_JSON_BYTES = 8_192
const WINDOW_MS = 60_000
const MAX_HITS = 60

type Bucket = { resetAt: number; hits: number }

type GlobalLimit = typeof globalThis & {
  __ancrumBingoRate?: Map<string, Bucket>
}

function rateMap(): Map<string, Bucket> {
  const g = globalThis as GlobalLimit
  g.__ancrumBingoRate ??= new Map()
  return g.__ancrumBingoRate
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 64)
  return request.headers.get('x-real-ip')?.trim().slice(0, 64) || 'unknown'
}

export function rateLimit(request: Request, bucket = 'rooms'): NextResponse | null {
  const key = `${bucket}:${clientKey(request)}`
  const now = Date.now()
  const map = rateMap()
  let entry = map.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { resetAt: now + WINDOW_MS, hits: 0 }
    map.set(key, entry)
  }
  entry.hits += 1
  if (entry.hits > MAX_HITS) {
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
