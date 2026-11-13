const base = process.env.BINGO_URL || 'http://127.0.0.1:3000'
const pin = process.env.CALLER_PIN?.trim()
if (!pin) {
  throw new Error('Set CALLER_PIN in the environment for smoke (same value the server uses)')
}

async function json(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

// Anonymous claim without PIN must fail
const noPin = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false } }),
})
const noPinBody = await json(noPin)
if (noPin.status !== 403 || noPinBody?.error !== 'pin_required') {
  throw new Error(`expected 403 pin_required without PIN, got ${noPin.status} ${noPinBody?.error}`)
}
if (noPinBody?.callerToken) throw new Error('anonymous POST without PIN returned a callerToken')

// Wrong PIN must fail
const badPin = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Pin': 'nope-wrong' },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false }, callerPin: 'nope-wrong' }),
})
const badPinBody = await json(badPin)
if (badPin.status !== 401 || badPinBody?.error !== 'bad_pin') {
  throw new Error(`expected 401 bad_pin, got ${badPin.status} ${badPinBody?.error}`)
}

// Valid PIN mints Caller token
const open = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Pin': pin },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false }, callerPin: pin }),
})
const opened = await json(open)
if (!open.ok || !opened?.callerToken) throw new Error(`open with PIN failed: ${open.status}`)
const token = opened.callerToken

// Stranger without PIN must not receive a new Caller token
const steal = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: { mode: 90, called: [9], joinHidden: true } }),
})
const stolen = await json(steal)
if (steal.status !== 403) throw new Error(`expected 403 on anonymous reclaim, got ${steal.status}`)
if (stolen?.callerToken) throw new Error('anonymous POST returned a callerToken')
if (stolen?.error !== 'pin_required') throw new Error(`expected pin_required, got ${stolen?.error}`)

// Real Caller can reopen with the existing token (no PIN)
const reopen = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false }, callerToken: token }),
})
const reopened = await json(reopen)
if (!reopen.ok || reopened?.callerToken !== token) {
  throw new Error('Caller reopen with valid token failed')
}

// PIN reclaim rotates token
const reclaim = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Pin': pin },
  body: JSON.stringify({ state: { mode: 90, called: [], joinHidden: false }, callerPin: pin }),
})
const reclaimed = await json(reclaim)
if (!reclaim.ok || !reclaimed?.callerToken) throw new Error('PIN reclaim failed')
if (reclaimed.callerToken === token) throw new Error('PIN reclaim did not rotate token')
const token2 = reclaimed.callerToken

// Old token must no longer authorize PUT
const stale = await fetch(`${base}/api/rooms/FETE`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token },
  body: JSON.stringify({ state: { mode: 90, called: [1], joinHidden: false } }),
})
if (stale.status !== 401) throw new Error(`expected 401 with rotated-away token, got ${stale.status}`)

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
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token2 },
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
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token2 },
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
  headers: { 'Content-Type': 'application/json', 'X-Caller-Token': token2 },
  body: `{"state":{"mode":90,"called":[],"joinHidden":false,"note":"${huge}"}}`,
})
if (big.status !== 413) throw new Error(`expected 413 for large body, got ${big.status}`)

// Display GET stays open without PIN
const get = await fetch(`${base}/api/rooms/FETE`)
const getBody = await json(get)
if (!get.ok || !getBody?.state) throw new Error('Display GET should stay open')

console.log('room-security-smoke ok', {
  updatedAt: put2Body.state.updatedAt,
  called: put2Body.state.called,
})
