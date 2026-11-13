import { chromium } from 'playwright'

const base = process.env.BINGO_URL || 'http://127.0.0.1:3000'

// Simulate two devices: separate browser contexts (no shared localStorage/BroadcastChannel)
const browser = await chromium.launch({ headless: true })
const callerCtx = await browser.newContext()
const displayCtx = await browser.newContext()
const caller = await callerCtx.newPage()
const display = await displayCtx.newPage()

const pin = process.env.HALL_CALLER_PIN?.trim()
if (!pin) {
  throw new Error('Set HALL_CALLER_PIN in the environment for smoke (same value the server uses)')
}

await caller.goto(`${base}/caller`)
await caller.waitForSelector('.caller')
// Wait for PIN gate or a real room (avoid racing the brief ···· placeholder while connecting)
await caller.waitForFunction(() => {
  if (document.querySelector('.caller-pin-input')) return true
  if (document.querySelector('.caller-show-code')) return true
  const el = document.querySelector('.room-code')
  return !!(el && el.textContent && !el.textContent.includes('·'))
}, null, { timeout: 20000 })
const pinInput = caller.locator('.caller-pin-input')
if (await pinInput.count()) {
  await pinInput.fill(pin)
  await caller.getByRole('button', { name: 'Unlock Caller' }).click()
  await caller.waitForSelector('.caller-pin-input', { state: 'detached' })
}
// If a prior test left joinHidden on, reveal the code banner
const show = caller.locator('.caller-show-code')
if (await show.count()) {
  await show.click()
}
await caller.waitForFunction(() => {
  const el = document.querySelector('.room-code')
  return el && el.textContent && !el.textContent.includes('·')
}, null, { timeout: 20000 })
const code = (await caller.locator('.room-code').innerText()).trim()
if (code !== 'FETE') throw new Error(`expected single hall code FETE, got: ${code}`)

// Caller must not show a QR — phones scan Display
if (await caller.locator('.room-qr').count()) {
  throw new Error('Caller still shows a QR — QR belongs on Display only')
}

const soundHits = []
display.on('request', (req) => {
  const u = req.url()
  if (u.includes('/sounds/bingo.wav') || u.includes('/sounds/full-house.wav')) soundHits.push(u)
})
await display.goto(`${base}/display`)
// Number stays in DOM; QR only while prep (empty board + code shown)
await display.waitForSelector('.display-number', { state: 'attached' })

const mobileCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const mobile = await mobileCtx.newPage()
await mobile.goto(`${base}/mobile?code=${code}`)
await mobile.waitForSelector('.mobile-number, .mobile-prep-colour')

const displayLast = async () =>
  ((await display.locator('.display-number').textContent()) || '').trim()

// Clear any leftover Bingo/Full House from a prior smoke run
const earlyDismiss = caller.getByRole('button', { name: 'Dismiss announcement' })
if (await earlyDismiss.count()) {
  await earlyDismiss.click()
  await caller.waitForSelector('.btn-bingo', { timeout: 8000 })
}
// Fresh board so debounce counts stay predictable across smoke runs
if (await caller.getByRole('button', { name: 'Clear board' }).isEnabled()) {
  await caller.getByRole('button', { name: 'Clear board' }).click()
  await caller.getByRole('button', { name: 'Clear all' }).click()
  await caller.waitForFunction(() => {
    const el = document.querySelector('.caller-last')
    return el && el.textContent && el.textContent.trim() === '—'
  })
}
// Reveal QR for prep if a prior Next hid the code
const showCode = caller.locator('.caller-show-code')
if (await showCode.count()) {
  await showCode.click()
}
await display.waitForSelector('.display-qr-overlay .room-qr', { timeout: 8000 })
await display.waitForSelector('.display-qr-prep .display-next-game-colour', { timeout: 8000 })

await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(1200)
// First Next hides the Display QR overlay
await display.waitForSelector('.display-qr-overlay', { state: 'detached', timeout: 8000 })
await caller.waitForSelector('.caller-show-code', { timeout: 5000 })
const callerNum = (await caller.locator('.caller-last').innerText()).trim()
const displayNum = await displayLast()
const mobileNum = (await mobile.locator('.mobile-number').innerText()).trim()
if (callerNum !== displayNum) {
  throw new Error(`room sync fail after next: caller=${callerNum} display=${displayNum}`)
}
if (callerNum !== mobileNum) {
  throw new Error(`mobile sync fail after next: caller=${callerNum} mobile=${mobileNum}`)
}

// Rapid multi-tap must only advance one number (sync triple-click in-page)
await caller.evaluate(() => {
  const btn = document.querySelector('.caller-next')
  if (!(btn instanceof HTMLButtonElement)) throw new Error('missing Next')
  btn.click()
  btn.click()
  btn.click()
})
await caller.waitForTimeout(500)
const afterBurst = (await caller.locator('.caller-last').innerText()).trim()
const calledCount = await caller.evaluate(() => {
  const raw = localStorage.getItem('ancrum-fete-bingo-state')
  if (!raw) return -1
  try {
    return (JSON.parse(raw).called || []).length
  } catch {
    return -1
  }
})
if (calledCount !== 2) {
  throw new Error(`Next debounce failed: expected 2 called after burst, got ${calledCount} (last=${afterBurst})`)
}
if (afterBurst === callerNum) {
  throw new Error('burst should have advanced exactly one number')
}

await caller.waitForTimeout(900)
await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(1200)
const third = (await caller.locator('.caller-last').innerText()).trim()
const thirdDisplay = await displayLast()
const thirdMobile = (await mobile.locator('.mobile-number').innerText()).trim()
if (third !== thirdDisplay) throw new Error('third call not room-synced')
if (third !== thirdMobile) throw new Error('third call not mobile-synced')
if (third === afterBurst) throw new Error('expected a new number after debounce window')

await caller.getByRole('button', { name: 'Undo last' }).click()
await caller.waitForTimeout(900)
const afterUndo = await displayLast()
if (afterUndo !== afterBurst) throw new Error(`undo not room-synced: ${afterUndo} expected ${afterBurst}`)

// Show code restores QR mid-game; Hide code removes it again
await caller.getByRole('button', { name: 'Show code' }).click()
await display.waitForSelector('.display-qr-overlay .room-qr', { timeout: 8000 })
await caller.getByRole('button', { name: 'Hide code' }).click()
await caller.waitForSelector('.caller-show-code', { timeout: 5000 })
await display.waitForSelector('.display-qr-overlay', { state: 'detached', timeout: 8000 })

// Clear any leftover hall alert from a prior run, then Bingo stays until dismiss
const dismiss = caller.getByRole('button', { name: 'Dismiss announcement' })
if (await dismiss.count()) {
  await dismiss.click()
  await caller.waitForSelector('.btn-bingo', { timeout: 8000 })
}
const soundsBeforeBingo = soundHits.length
await caller.getByRole('button', { name: 'Bingo' }).click()
await display.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await mobile.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await caller.waitForTimeout(1200)
// Probe on join and/or Bingo press should touch bingo.wav on Display only
if (!soundHits.some((u) => u.includes('/sounds/bingo.wav'))) {
  throw new Error('Display should load /sounds/bingo.wav for Bingo alerts')
}
if (await mobile.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('/sounds/')))) {
  throw new Error('Mobile must not load hall alert sounds')
}
if (!(await display.locator('.hall-alert--bingo').count())) {
  throw new Error('Bingo alert should stay until dismissed or Next')
}
if (!(await caller.getByRole('button', { name: 'Next number' }).isEnabled())) {
  throw new Error('Next number should stay enabled while Bingo is showing')
}
if (await caller.getByRole('button', { name: 'Undo last' }).isEnabled()) {
  throw new Error('Undo last should be disabled while Bingo is showing')
}
if (await caller.getByRole('button', { name: '90-ball' }).count()) {
  throw new Error('90/75 mode switch should hide once numbers are called')
}
await caller.getByRole('button', { name: 'Dismiss announcement' }).click()
await display.waitForSelector('.hall-alert--bingo', { state: 'detached', timeout: 8000 })
await mobile.waitForSelector('.hall-alert--bingo', { state: 'detached', timeout: 8000 })

await caller.getByRole('button', { name: 'Full House' }).click()
await display.waitForSelector('.hall-alert--full-house', { timeout: 8000 })
await mobile.waitForSelector('.hall-alert--full-house', { timeout: 8000 })
await caller.waitForTimeout(800)
if (!soundHits.some((u) => u.includes('/sounds/full-house.wav'))) {
  throw new Error('Display should load /sounds/full-house.wav when Full House is pressed')
}
if (!(await caller.getByRole('button', { name: 'Next number' }).isEnabled())) {
  throw new Error('Next number should stay enabled while Full House is showing')
}
// Next number dismisses the Full House announcement and advances
const beforeNextDismiss = (await caller.locator('.caller-last').innerText()).trim()
await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(1200)
await display.waitForSelector('.hall-alert--full-house', { state: 'detached', timeout: 8000 })
const afterNextDismiss = (await caller.locator('.caller-last').innerText()).trim()
if (afterNextDismiss === beforeNextDismiss) {
  throw new Error('Next during Full House should call a new number')
}

// Checker pad: Caller QR → quiet called-numbers screen (no Bingo / Girty)
await caller.getByRole('button', { name: 'Checker QR' }).click()
await caller.waitForSelector('.dialog--checker-qr .room-qr', { timeout: 8000 })
const checkerHref = await caller.locator('.dialog--checker-qr .room-qr-link').getAttribute('href')
if (!checkerHref || !checkerHref.includes('/checker?code=')) {
  throw new Error(`Checker QR should encode /checker?code=, got ${checkerHref}`)
}
await caller.getByRole('button', { name: 'Done' }).click()
await caller.waitForSelector('.dialog--checker-qr', { state: 'detached', timeout: 5000 })

const checkerCtx = await browser.newContext({ viewport: { width: 1100, height: 800 } })
const checker = await checkerCtx.newPage()
await checker.goto(`${base}/checker?code=${code}`)
await checker.waitForSelector('.checker--live .checker-number', { timeout: 15000 })
await checker.waitForSelector('.checker-called-chips .checker-chip', { timeout: 8000 })
const checkerLast = ((await checker.locator('.checker-number').textContent()) || '').trim()
const displayNow = await displayLast()
if (checkerLast !== displayNow) {
  throw new Error(`checker last mismatch: checker=${checkerLast} display=${displayNow}`)
}
// Fire Bingo again — Display gets the banner; Checker gets a small cue only
await caller.getByRole('button', { name: 'Bingo' }).click()
await display.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await mobile.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await checker.waitForSelector('.checker-cue--bingo', { timeout: 8000 })
if (await checker.locator('.hall-alert').count()) {
  throw new Error('Checker must not show Bingo / Full House banners')
}
if (await checker.locator('.girty-overlay').count()) {
  throw new Error('Checker must not show Dirty Girty')
}
await caller.getByRole('button', { name: 'Dismiss announcement' }).click()
await display.waitForSelector('.hall-alert--bingo', { state: 'detached', timeout: 8000 })
await checker.waitForSelector('.checker-cue', { state: 'detached', timeout: 8000 })

// High-contrast Display toggle from Caller
await caller.getByRole('button', { name: 'Contrast' }).click()
await display.waitForSelector('.display--contrast', { timeout: 8000 })
await caller.getByRole('button', { name: 'Contrast' }).click()
await display.waitForSelector('.display--contrast', { state: 'detached', timeout: 8000 })

// New game picks a colour, clears the board, reveals QR + colour for prep
await caller.getByRole('button', { name: 'New game' }).click()
await caller.waitForSelector('.dialog--new-game')
await caller.locator('.theme-swatch--pink').click()
await caller.getByRole('button', { name: 'Start game' }).click()
await caller.waitForSelector('.dialog--new-game', { state: 'detached', timeout: 5000 })
await caller.waitForFunction(() => {
  const el = document.querySelector('.caller-last')
  return el && el.textContent && el.textContent.trim() === '—'
})
await display.waitForSelector('.display.theme-pink', { timeout: 8000 })
await display.waitForSelector('.display-qr-overlay', { timeout: 8000 })
await display.waitForSelector('.display-qr-prep .display-next-game-colour--pink', { timeout: 8000 })
await mobile.waitForSelector('.mobile.theme-pink', { timeout: 8000 })
await mobile.waitForSelector('.mobile-prep-colour--pink', { timeout: 8000 })
const afterNew = await displayLast()
if (afterNew !== '—') throw new Error(`new game should clear Display number, got ${afterNew}`)

// First Next after New game hides QR again
await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(1200)
await display.waitForSelector('.display-qr-overlay', { state: 'detached', timeout: 8000 })

console.log('room-sync-smoke ok', {
  code,
  first: callerNum,
  afterBurst,
  third,
  mobile: true,
  alerts: true,
  checker: true,
  contrast: true,
  newGame: 'pink',
  newGamePrep: true,
  nextHidesQr: true,
  nextDebounce: true,
  displaySounds: true,
})
await browser.close()
