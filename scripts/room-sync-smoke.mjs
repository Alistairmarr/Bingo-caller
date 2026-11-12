import { chromium } from 'playwright'

const base = process.env.BINGO_URL || 'http://127.0.0.1:3000'

// Simulate two devices: separate browser contexts (no shared localStorage/BroadcastChannel)
const browser = await chromium.launch({ headless: true })
const callerCtx = await browser.newContext()
const displayCtx = await browser.newContext()
const caller = await callerCtx.newPage()
const display = await displayCtx.newPage()

await caller.goto(`${base}/caller`)
await caller.waitForSelector('.caller')
// If a prior test left joinHidden on, reveal the code banner
const show = caller.locator('.caller-show-code')
if (await show.count()) await show.click()
await caller.waitForSelector('.room-code')
await caller.waitForFunction(() => {
  const el = document.querySelector('.room-code')
  return el && el.textContent && !el.textContent.includes('·')
})
const code = (await caller.locator('.room-code').innerText()).trim()
if (code !== 'FETE') throw new Error(`expected single hall code FETE, got: ${code}`)

await display.goto(`${base}/display`)
await display.fill('.join-input', code)
await display.getByRole('button', { name: 'Join display' }).click()
await display.waitForSelector('.display-number')

await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(900)
const callerNum = (await caller.locator('.caller-last').innerText()).trim()
const displayNum = (await display.locator('.display-number').innerText()).trim()
if (callerNum !== displayNum) {
  throw new Error(`room sync fail after next: caller=${callerNum} display=${displayNum}`)
}

await caller.getByRole('button', { name: 'Next number' }).click()
await caller.waitForTimeout(900)
const second = (await caller.locator('.caller-last').innerText()).trim()
const secondDisplay = (await display.locator('.display-number').innerText()).trim()
if (second !== secondDisplay) throw new Error('second call not room-synced')

await caller.getByRole('button', { name: 'Undo last' }).click()
await caller.waitForTimeout(900)
const afterUndo = (await display.locator('.display-number').innerText()).trim()
if (afterUndo !== callerNum) throw new Error(`undo not room-synced: ${afterUndo} expected ${callerNum}`)

console.log('room-sync-smoke ok', { code, first: callerNum, second })
await browser.close()
