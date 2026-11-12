'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
import { normalizeRoomCode } from './game/roomApi'
import { useBingoStore } from './game/store'
import { lastCalled } from './game/types'

export function DisplayView() {
  const { state, room, roomStatus, roomError, joinRoom } = useBingoStore({ role: 'display' })
  const [draft, setDraft] = useState('')
  const last = lastCalled(state)
  const joined = !!room

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(draft)
    if (code.length !== 4) return
    await joinRoom(code)
  }

  return (
    <main className="display">
      <div className="display-atmosphere" aria-hidden />
      <header className="display-bar">
        <Link className="brand-quiet" href="/">
          <MarketCrossMark className="brand-inline-cross" />
          Ancrum Fete Bingo
        </Link>
        <p className="display-meta">
          {joined ? (
            <>
              <span className="display-mode">{state.mode}-ball</span>
              <span className="display-count">{state.called.length} called</span>
              <span className="display-room">Room {room}</span>
            </>
          ) : (
            <span className="display-count">Join a room</span>
          )}
        </p>
      </header>

      {!joined ? (
        <section className="join-panel">
          <h2>Enter the room code from the Pad</h2>
          <p>Open Caller on the games-master tablet first — it shows a four-character code.</p>
          <form className="join-form" onSubmit={(e) => void onJoin(e)}>
            <input
              className="join-input"
              value={draft}
              onChange={(e) => setDraft(normalizeRoomCode(e.target.value))}
              placeholder="e.g. K7MP"
              aria-label="Room code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              inputMode="text"
            />
            <button type="submit" className="btn btn-next" disabled={draft.length !== 4}>
              Join display
            </button>
          </form>
          {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
          <p className="join-hint">
            Same browser demo: open Caller in another tab — local sync still works without joining.
          </p>
        </section>
      ) : (
        <>
          <section className="display-hero" aria-live="polite" aria-atomic="true">
            <p className="display-label">
              Last called
              {roomStatus === 'live' ? ' · live' : roomStatus === 'connecting' ? ' · linking…' : ''}
            </p>
            <p className={`display-number ${last ? 'display-number--pop' : ''}`} key={last ?? 'empty'}>
              {last ?? '—'}
            </p>
            {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
          </section>

          <section className="display-board-wrap" aria-label="Called numbers board">
            <div className="board-frame">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} />
            </div>
          </section>
        </>
      )}
    </main>
  )
}
