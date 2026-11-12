const base = process.env.BINGO_URL || 'http://127.0.0.1:3000'

async function json(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

// Open hall room as Caller
const open = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false } }),
})
const opened = await json(open)
if (!open.ok || !opened?.callerToken) throw new Error('open failed')
const token = opened.callerToken

// Unauthorized PUT must fail
const bad = await fetch(`${base}/api/rooms/FETE`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: { mode: 90, called: [1, 2, 3], joinHidden: false, updatedAt: 9e15 } }),
})
if (bad.status !== 401) throw new Error(`expected 401 without token, got ${bad.status}`)

// Inflated client updatedAt must not stick — server stamps time
const put = await fetch(`${base}/api/rooms/FETE`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
  body: JSON.stringify({
    state: { mode: 90, called: [30], joinHidden: false, updatedAt: Number.MAX_SAFE_INTEGER },
  }),
})
const putBody = await json(put)
if (!put.ok) throw new Error(`authorized put failed: ${put.status}`)
if (putBody.state.updatedAt > Date.now() + 60_000) {
  throw new Error(`server trusted inflated updatedAt: ${putBody.state.updatedAt}`)
}
if (!putBody.state.called.includes(30)) throw new Error('missing called 30')

// Later write still works (room not frozen)
const put2 = await fetch(`${base}/api/rooms/FETE`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
  body: JSON.stringify({ state: { mode: 90, called: [30, 7], joinHidden: false, updatedAt: 1 } }),
})
const put2Body = await json(put2)
if (!put2.ok) throw new Error(`second put failed: ${put2.status}`)
if (put2Body.state.updatedAt <= putBody.state.updatedAt) throw new Error('updatedAt did not advance')
if (put2Body.state.called.join(',') !== '30,7') throw new Error('called list not applied')

// Oversized body rejected
const huge = 'x'.repeat(20_000)
const big = await fetch(`${base}/api/rooms/FETE`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
  body: `{"state":{"mode":90,"called":[],"joinHidden":false,"note":"${huge}"}}`,
})
if (big.status !== 413) throw new Error(`expected 413 for large body, got ${big.status}`)

console.log('room-security-smoke ok', {
  updatedAt: put2Body.state.updatedAt,
  called: put2Body.state.called,
})
