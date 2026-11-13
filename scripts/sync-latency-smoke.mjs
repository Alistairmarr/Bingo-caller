/**
 * Measure Caller PUT → Display GET visibility lag (server path).
 * Usage: HALL_CALLER_PIN=… node scripts/sync-latency-smoke.mjs
 */
const base = process.env.BINGO_URL || 'http://127.0.0.1:3000'
const pin = process.env.HALL_CALLER_PIN?.trim()
if (!pin) throw new Error('Set HALL_CALLER_PIN for sync-latency-smoke')

async function json(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const open = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Pin': pin },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false }, callerPin: pin }),
})
const opened = await json(open)
if (!open.ok || !opened?.callerToken) throw new Error(`open failed: ${open.status}`)
const token = opened.callerToken

const samples = []
let etag = null
for (let i = 0; i < 8; i++) {
  const marker = 10 + i
  const t0 = performance.now()
  const put = await fetch(`${base}/api/rooms/FETE`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
    body: JSON.stringify({ state: { mode: 90, called: [marker], joinHidden: false } }),
  })
  const putBody = await json(put)
  if (!put.ok) throw new Error(`put failed: ${put.status}`)
  const want = putBody.state.updatedAt

  // Simulate Display polls at 200ms with If-None-Match
  let seen = false
  let lag = null
  for (let attempt = 0; attempt < 40; attempt++) {
    const headers = etag ? { 'If-None-Match': etag } : {}
    const get = await fetch(`${base}/api/rooms/FETE`, { headers, cache: 'no-store' })
    if (get.status === 304) {
      await new Promise((r) => setTimeout(r, 200))
      continue
    }
    const body = await json(get)
    const nextEtag = get.headers.get('etag')
    if (nextEtag) etag = nextEtag
    if (body?.state?.updatedAt === want && body.state.called?.includes(marker)) {
      lag = performance.now() - t0
      seen = true
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!seen) throw new Error(`sample ${i} never synced`)
  samples.push(lag)
}

samples.sort((a, b) => a - b)
const avg = samples.reduce((a, b) => a + b, 0) / samples.length
const p50 = samples[Math.floor(samples.length / 2)]
const p95 = samples[Math.floor(samples.length * 0.95)] || samples[samples.length - 1]

console.log('sync-latency-smoke ok', {
  pollMs: 200,
  samplesMs: samples.map((n) => Math.round(n)),
  avgMs: Math.round(avg),
  p50Ms: Math.round(p50),
  p95Ms: Math.round(p95),
  note: 'PUT→GET visibility on server path; Display UI also waits ≤ poll interval',
})
