'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { DirtyGirty } from './DirtyGirty'
import { MarketCrossMark } from './Emblems'
import { NewGameDialog } from './NewGameDialog'
import { NumberBoard } from './NumberBoard'
import { remainingCount } from './game/logic'
import { useBingoStore } from './game/store'
import { lastCalled, maxBall, type BingoMode } from './game/types'
import { ukCallName } from './game/ukCallNames'

const CALL_NAMES_KEY = 'ancrum-fete-bingo-caller-call-names'

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
    signalHallAlert,
    dismissHallAlert,
    changeHighContrast,
    beginNewGame,
    ensureCallerRoom,
  } = useBingoStore({ role: 'caller' })
  const [clearOpen, setClearOpen] = useState(false)
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [modePending, setModePending] = useState<BingoMode | null>(null)
  const [copied, setCopied] = useState(false)
  const [nextLocked, setNextLocked] = useState(false)
  const nextLockRef = useRef(false)
  const [pinDraft, setPinDraft] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [showCallNames, setShowCallNames] = useState(false)

  useEffect(() => {
    void ensureCallerRoom()
  }, [ensureCallerRoom])

  useEffect(() => {
    try {
      setShowCallNames(sessionStorage.getItem(CALL_NAMES_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!nextLocked) return
    const id = window.setTimeout(() => {
      nextLockRef.current = false
      setNextLocked(false)
    }, 1100)
    return () => window.clearTimeout(id)
  }, [nextLocked])

  const toggleCallNames = () => {
    setShowCallNames((prev) => {
      const next = !prev
      try {
        sessionStorage.setItem(CALL_NAMES_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const last = lastCalled(state)
  const callName = showCallNames ? ukCallName(last) : null
  const remaining = remainingCount(state)
  const exhausted = remaining === 0
  const girty = last === 30
  const codeHidden = state.joinHidden
  const showPinGate = needsCallerPin || (!room && roomStatus === 'error')

  // Keep the pad awake while Caller is open (hall night).
  useEffect(() => {
    if (showPinGate) return
    let lock: { release: () => Promise<void> } | null = null
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
        }
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        /* unsupported / denied */
      }
    }
    void request()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [showPinGate])

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

  const alertActive = !!state.hallAlert

  const onNext = () => {
    // Ref gate first — React state alone can let two taps through before re-render
    if (exhausted || nextLockRef.current || nextLocked || showPinGate || alertActive) return
    nextLockRef.current = true
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
    <main
      className={`caller theme-${state.themeColor} ${codeHidden ? 'caller--code-hidden' : ''}`}
      data-theme={state.themeColor}
    >
      <header className="caller-top">
        <div>
          <Link className="back-link" href="/">
            <MarketCrossMark className="brand-inline-cross" />
            Ancrum Fete Bingo
          </Link>
          <h1 className="sr-only">Caller</h1>
        </div>
        <div className="caller-top-actions">
          {state.called.length === 0 ? (
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
          ) : (
            <p className="caller-mode-locked" aria-label="Game mode">
              {state.mode}-ball
            </p>
          )}
          <button
            type="button"
            className={showCallNames ? 'mode-btn mode-btn--active' : 'mode-btn'}
            onClick={toggleCallNames}
            disabled={showPinGate}
            aria-pressed={showCallNames}
            title="Show UK bingo call names under the last number (Caller only)"
          >
            Call names
          </button>
          <button
            type="button"
            className={state.highContrast ? 'mode-btn mode-btn--active' : 'mode-btn'}
            onClick={() => changeHighContrast(!state.highContrast)}
            disabled={showPinGate}
            aria-pressed={state.highContrast}
            title="High-contrast TV Display for older eyes"
          >
            Contrast
          </button>
          <button
            type="button"
            className="mode-btn"
            onClick={() => setNewGameOpen(true)}
            disabled={showPinGate || !room}
          >
            New game
          </button>
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
          <p>Enter the hall Caller PIN once. Display and phone QR stay open without it.</p>
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
        <section className="room-banner room-banner--compact" aria-live="polite">
          <div className="room-banner-main">
            <div>
              <p className="room-label">Hall room · TV joins with code · phone QR is on Display</p>
              <p className="room-code">{room ?? '····'}</p>
              <p className="room-status">
                {roomStatus === 'live' && 'Caller pad — QR lives on the TV Display for phones'}
                {roomStatus === 'connecting' && 'Opening hall room…'}
                {roomStatus === 'error' && (roomError || 'Room sync issue — local tab sync still works')}
                {roomStatus === 'idle' && 'Preparing room…'}
              </p>
            </div>
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
          <div className="caller-stage">
            <div className="caller-call-panel">
              <section className="caller-hero" aria-live="polite">
                <p className="caller-kicker">
                  {state.mode}-ball · {state.called.length} called
                  {exhausted
                    ? ''
                    : remaining === maxBall(state.mode)
                      ? ' · ready'
                      : ` · ${remaining} left`}
                </p>
                <p
                  className={`caller-last ${last ? 'caller-last--pop' : ''} ${girty ? 'caller-last--girty' : ''}`}
                  key={last ?? 'empty'}
                >
                  {last ?? '—'}
                </p>
                {callName ? <p className="caller-call-name">{callName}</p> : null}
              </section>

              <div className="caller-secondary">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={undo}
                  disabled={state.called.length === 0 || alertActive}
                  title={alertActive ? 'Dismiss Bingo / Full House first' : undefined}
                >
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
            </div>

            <div className="caller-board-column">
              <button
                type="button"
                className="btn caller-next"
                onClick={onNext}
                disabled={exhausted || nextLocked || alertActive}
                title={alertActive ? 'Dismiss Bingo / Full House first' : undefined}
              >
                Next number
              </button>
              <section className="caller-board-wrap" aria-label="Called numbers">
                <div className="board-frame board-frame--compact board-frame--square">
                  <NumberBoard mode={state.mode} called={state.called} highlight={last} compact />
                </div>
              </section>
            </div>
          </div>

          {/* Bottom of pad — kept away from Next number to avoid fat-finger misses */}
          <div className="caller-alerts" role="group" aria-label="Hall win alerts">
            {state.hallAlert ? (
              <div className="caller-alert-live">
                <p className="caller-alert-live-text">
                  {state.hallAlert.kind === 'bingo' ? 'Bingo' : 'Full House'} showing on TV &amp; phones
                </p>
                <button type="button" className="btn btn-secondary caller-alert-dismiss" onClick={dismissHallAlert}>
                  Dismiss announcement
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-bingo"
                  onClick={() => signalHallAlert('bingo')}
                  disabled={!room}
                >
                  Bingo
                </button>
                <button
                  type="button"
                  className="btn btn-full-house"
                  onClick={() => signalHallAlert('full_house')}
                  disabled={!room}
                >
                  Full House
                </button>
              </>
            )}
          </div>
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

      <NewGameDialog
        open={newGameOpen}
        current={state.themeColor}
        onCancel={() => setNewGameOpen(false)}
        onConfirm={(color) => {
          beginNewGame(color)
          setNewGameOpen(false)
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
