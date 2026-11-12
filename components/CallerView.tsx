'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
import { remainingCount } from './game/logic'
import { useBingoStore } from './game/store'
import { lastCalled, maxBall, type BingoMode } from './game/types'

export function CallerView() {
  const { state, room, roomStatus, roomError, callNext, undo, clear, changeMode, ensureCallerRoom } =
    useBingoStore({ role: 'caller' })
  const [clearOpen, setClearOpen] = useState(false)
  const [modePending, setModePending] = useState<BingoMode | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void ensureCallerRoom()
  }, [ensureCallerRoom])

  const last = lastCalled(state)
  const remaining = remainingCount(state)
  const exhausted = remaining === 0

  const requestMode = (mode: BingoMode) => {
    if (mode === state.mode) return
    if (state.called.length > 0) {
      setModePending(mode)
      return
    }
    changeMode(mode)
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
    <main className="caller">
      <header className="caller-top">
        <div>
          <Link className="back-link" href="/">
            <MarketCrossMark className="brand-inline-cross" />
            Ancrum Fete Bingo
          </Link>
          <h1 className="sr-only">Caller</h1>
        </div>
        <div className="mode-switch" role="group" aria-label="Game mode">
          <button
            type="button"
            className={state.mode === 90 ? 'mode-btn mode-btn--active' : 'mode-btn'}
            onClick={() => requestMode(90)}
          >
            90-ball
          </button>
          <button
            type="button"
            className={state.mode === 75 ? 'mode-btn mode-btn--active' : 'mode-btn'}
            onClick={() => requestMode(75)}
          >
            75-ball
          </button>
        </div>
      </header>

      <section className="room-banner" aria-live="polite">
        <div>
          <p className="room-label">Room code for the TV</p>
          <p className="room-code">{room ?? '····'}</p>
          <p className="room-status">
            {roomStatus === 'live' && 'Live — Display can join with this code'}
            {roomStatus === 'connecting' && 'Starting room…'}
            {roomStatus === 'error' && (roomError || 'Room sync issue — local tab sync still works')}
            {roomStatus === 'idle' && 'Preparing room…'}
          </p>
        </div>
        <div className="room-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void copyCode()} disabled={!room}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void ensureCallerRoom(true)}>
            New room
          </button>
        </div>
      </section>

      <section className="caller-hero" aria-live="polite">
        <p className="caller-kicker">
          {state.mode}-ball · {state.called.length} called
        </p>
        <p className={`caller-last ${last ? 'caller-last--pop' : ''}`} key={last ?? 'empty'}>
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
        <button type="button" className="btn btn-next" onClick={callNext} disabled={exhausted}>
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
