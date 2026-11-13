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
// Fresh pad / locked hall: enter Caller PIN once
const pinInput = caller.locator('.caller-pin-input')
if (await pinInput.count()) {
  await pinInput.fill(pin)
  await caller.getByRole('button', { name: 'Unlock Caller' }).click()
  await caller.waitForSelector('.caller-pin-input', { state: 'detached' })
}
// If a prior test left joinHidden on, reveal the code banner
const show = caller.locator('.caller-show-code')
await Promise.race([
  caller.waitForSelector('.room-code', { timeout: 15000 }),
  show.waitFor({ state: 'visible', timeout: 15000 }).then(async () => {
    await show.click()
    await caller.waitForSelector('.room-code')
  }),
])
await caller.waitForFunction(() => {
  const el = document.querySelector('.room-code')
  return el && el.textContent && !el.textContent.includes('·')
})
const code = (await caller.locator('.room-code').innerText()).trim()
if (code !== 'FETE') throw new Error(`expected single hall code FETE, got: ${code}`)

// Caller must not show a QR — phones scan Display
if (await caller.locator('.room-qr').count()) {
  throw new Error('Caller still shows a QR — QR belongs on Display only')
}

await display.goto(`${base}/display`)
// QR overlay covers the board; number stays in DOM but is not "visible" to Playwright
await display.waitForSelector('.display-number', { state: 'attached' })
await display.waitForSelector('.display-qr-overlay .room-qr')

const mobileCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const mobile = await mobileCtx.newPage()
await mobile.goto(`${base}/mobile?code=${code}`)
await mobile.waitForSelector('.mobile-number')

const displayLast = async () =>
  ((await display.locator('.display-number').textContent()) || '').trim()

await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(900)
const callerNum = (await caller.locator('.caller-last').innerText()).trim()
const displayNum = await displayLast()
const mobileNum = (await mobile.locator('.mobile-number').innerText()).trim()
if (callerNum !== displayNum) {
  throw new Error(`room sync fail after next: caller=${callerNum} display=${displayNum}`)
}
if (callerNum !== mobileNum) {
  throw new Error(`mobile sync fail after next: caller=${callerNum} mobile=${mobileNum}`)
}

await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(900)
const second = (await caller.locator('.caller-last').innerText()).trim()
const secondDisplay = await displayLast()
const secondMobile = (await mobile.locator('.mobile-number').innerText()).trim()
if (second !== secondDisplay) throw new Error('second call not room-synced')
if (second !== secondMobile) throw new Error('second call not mobile-synced')

await caller.getByRole('button', { name: 'Undo last' }).click()
await caller.waitForTimeout(900)
const afterUndo = await displayLast()
if (afterUndo !== callerNum) throw new Error(`undo not room-synced: ${afterUndo} expected ${callerNum}`)

// Hide code on Caller hides Display QR overlay
await caller.getByRole('button', { name: 'Hide code' }).click()
await caller.waitForSelector('.caller-show-code', { timeout: 5000 })
await display.waitForSelector('.display-qr-overlay', { state: 'detached', timeout: 8000 })

// Clear any leftover hall alert from a prior run, then Bingo stays until dismiss
const dismiss = caller.getByRole('button', { name: 'Dismiss announcement' })
if (await dismiss.count()) {
  await dismiss.click()
  await caller.waitForSelector('.btn-bingo', { timeout: 8000 })
}
await caller.getByRole('button', { name: 'Bingo' }).click()
await display.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await mobile.waitForSelector('.hall-alert--bingo', { timeout: 8000 })
await caller.waitForTimeout(1200)
if (!(await display.locator('.hall-alert--bingo').count())) {
  throw new Error('Bingo alert should stay until Caller dismisses')
}
if (await caller.getByRole('button', { name: 'Next number' }).isEnabled()) {
  throw new Error('Next number should be disabled while Bingo is showing')
}
await caller.getByRole('button', { name: 'Dismiss announcement' }).click()
await display.waitForSelector('.hall-alert--bingo', { state: 'detached', timeout: 8000 })
await mobile.waitForSelector('.hall-alert--bingo', { state: 'detached', timeout: 8000 })
if (!(await caller.getByRole('button', { name: 'Next number' }).isEnabled())) {
  throw new Error('Next number should re-enable after dismiss')
}

await caller.getByRole('button', { name: 'Full House' }).click()
await display.waitForSelector('.hall-alert--full-house', { timeout: 8000 })
await mobile.waitForSelector('.hall-alert--full-house', { timeout: 8000 })
if (await caller.getByRole('button', { name: 'Next number' }).isEnabled()) {
  throw new Error('Next number should be disabled while Full House is showing')
}
await caller.getByRole('button', { name: 'Dismiss announcement' }).click()
await display.waitForSelector('.hall-alert--full-house', { state: 'detached', timeout: 8000 })

console.log('room-sync-smoke ok', { code, first: callerNum, second, mobile: true, alerts: true })
await browser.close()
