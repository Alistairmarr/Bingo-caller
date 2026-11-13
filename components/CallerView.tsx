'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { DirtyGirty } from './DirtyGirty'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
import { RoomQr } from './RoomQr'
import { remainingCount } from './game/logic'
import { useBingoStore } from './game/store'
import { lastCalled, maxBall, type BingoMode } from './game/types'

export function CallerView() {
  const {
    state,
    room,
    roomStatus,
    roomError,
    needsCallerPin,
    callNext,
    undo,
    clear,
    changeMode,
    changeJoinHidden,
    ensureCallerRoom,
  } = useBingoStore({ role: 'caller' })
  const [clearOpen, setClearOpen] = useState(false)
  const [modePending, setModePending] = useState<BingoMode | null>(null)
  const [copied, setCopied] = useState(false)
  const [nextLocked, setNextLocked] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const [pinBusy, setPinBusy] = useState(false)

  useEffect(() => {
    void ensureCallerRoom()
  }, [ensureCallerRoom])

  useEffect(() => {
    if (!nextLocked) return
    const id = window.setTimeout(() => setNextLocked(false), 1000)
    return () => window.clearTimeout(id)
  }, [nextLocked])

  const last = lastCalled(state)
  const remaining = remainingCount(state)
  const exhausted = remaining === 0
  const girty = last === 30
  const codeHidden = state.joinHidden
  const showPinGate = needsCallerPin || (!room && roomStatus === 'error')

  const submitPin = async (e: FormEvent) => {
    e.preventDefault()
    const pin = pinDraft.trim()
    if (!pin || pinBusy) return
    setPinBusy(true)
    try {
      await ensureCallerRoom(pin)
      setPinDraft('')
    } finally {
      setPinBusy(false)
    }
  }

  const requestMode = (mode: BingoMode) => {
    if (mode === state.mode) return
    if (state.called.length > 0) {
      setModePending(mode)
      return
    }
    changeMode(mode)
  }

  const onNext = () => {
    if (exhausted || nextLocked || showPinGate) return
    setNextLocked(true)
    callNext()
  }

  const copyCode = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(room)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <main className={`caller ${codeHidden ? 'caller--code-hidden' : ''}`}>
      <header className="caller-top">
        <div>
          <Link className="back-link" href="/">
            <MarketCrossMark className="brand-inline-cross" />
            Ancrum Fete Bingo
          </Link>
          <h1 className="sr-only">Caller</h1>
        </div>
        <div className="caller-top-actions">
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button
              type="button"
              className={state.mode === 90 ? 'mode-btn mode-btn--active' : 'mode-btn'}
              onClick={() => requestMode(90)}
              disabled={showPinGate}
            >
              90-ball
            </button>
            <button
              type="button"
              className={state.mode === 75 ? 'mode-btn mode-btn--active' : 'mode-btn'}
              onClick={() => requestMode(75)}
              disabled={showPinGate}
            >
              75-ball
            </button>
          </div>
          {codeHidden ? (
            <button
              type="button"
              className="btn btn-secondary caller-show-code"
              onClick={() => changeJoinHidden(false)}
              disabled={showPinGate}
            >
              Show code
            </button>
          ) : null}
        </div>
      </header>

      {showPinGate ? (
        <section className="caller-pin-panel" aria-live="polite">
          <h2>Caller PIN</h2>
          <p>Enter the hall Caller PIN once. Display and QR stay open without it.</p>
          <form className="caller-pin-form" onSubmit={(e) => void submitPin(e)}>
            <input
              className="caller-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value)}
              placeholder="PIN"
              aria-label="Caller PIN"
              disabled={pinBusy}
            />
            <button type="submit" className="btn btn-next" disabled={!pinDraft.trim() || pinBusy}>
              {pinBusy ? 'Unlocking…' : 'Unlock Caller'}
            </button>
          </form>
          {roomError ? <p className="join-error">{roomError}</p> : null}
        </section>
      ) : null}

      {!showPinGate && !codeHidden ? (
        <section className="room-banner" aria-live="polite">
          <div className="room-banner-main">
            <div>
              <p className="room-label">Hall room · TV code · phone QR</p>
              <p className="room-code">{room ?? '····'}</p>
              <p className="room-status">
                {roomStatus === 'live' && 'One hall room — Display & phones join here'}
                {roomStatus === 'connecting' && 'Opening hall room…'}
                {roomStatus === 'error' && (roomError || 'Room sync issue — local tab sync still works')}
                {roomStatus === 'idle' && 'Preparing room…'}
              </p>
            </div>
            {room ? <RoomQr code={room} size={220} className="room-qr-wrap--caller" /> : null}
          </div>
          <div className="room-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void copyCode()} disabled={!room}>
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => changeJoinHidden(true)} disabled={!room}>
              Hide code
            </button>
          </div>
        </section>
      ) : null}

      {!showPinGate ? (
        <>
          <section className="caller-hero" aria-live="polite">
            <p className="caller-kicker">
              {state.mode}-ball · {state.called.length} called
            </p>
            <p
              className={`caller-last ${last ? 'caller-last--pop' : ''} ${girty ? 'caller-last--girty' : ''}`}
              key={last ?? 'empty'}
            >
              {last ?? '—'}
            </p>
            <p className="caller-sub">
              {exhausted
                ? 'All numbers called'
                : remaining === maxBall(state.mode)
                  ? 'Ready to call'
                  : `${remaining} left`}
            </p>
          </section>

          <div className="caller-controls">
            <button type="button" className="btn btn-next" onClick={onNext} disabled={exhausted || nextLocked}>
              Next number
            </button>
            <button type="button" className="btn btn-secondary" onClick={undo} disabled={state.called.length === 0}>
              Undo last
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setClearOpen(true)}
              disabled={state.called.length === 0}
            >
              Clear board
            </button>
          </div>

          <section className="caller-board-wrap" aria-label="Called numbers">
            <div className="board-frame board-frame--compact">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} compact />
            </div>
          </section>
        </>
      ) : null}

      <DirtyGirty trigger={girty} />

      <ConfirmDialog
        open={clearOpen}
        title="Clear the board?"
        body="This removes every called number for the current game. You can’t undo a clear."
        confirmLabel="Clear all"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          clear()
          setClearOpen(false)
        }}
      />

      <ConfirmDialog
        open={modePending !== null}
        title={`Switch to ${modePending}-ball?`}
        body="Numbers have already been called. Switching mode clears the board and starts fresh."
        confirmLabel={`Switch to ${modePending}`}
        danger
        onCancel={() => setModePending(null)}
        onConfirm={() => {
          if (modePending) changeMode(modePending)
          setModePending(null)
        }}
      />
    </main>
  )
}
