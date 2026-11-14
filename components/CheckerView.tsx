'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
import { normalizeRoomCode } from './game/roomApi'
import { useBingoStore } from './game/store'
import { lastCalled } from './game/types'

/**
 * Checker pad — clear called-numbers view for verifying a bingo card.
 * Small cue when Caller signals Bingo / Full House; no hall banners or Dirty Girty.
 */
export function CheckerView() {
  const searchParams = useSearchParams()
  const { state, room, roomStatus, roomError, joinRoom } = useBingoStore({ role: 'display' })
  const [draft, setDraft] = useState('FETE')
  const autoTried = useRef(false)
  const last = lastCalled(state)
  const joined = !!room
  const checkCue = state.hallAlert?.kind ?? null

  const calledSorted = useMemo(
    () => [...state.called].sort((a, b) => a - b),
    [state.called],
  )

  useEffect(() => {
    const fromQuery = normalizeRoomCode(searchParams.get('code') ?? '')
    if (fromQuery.length === 4) setDraft(fromQuery)
  }, [searchParams])

  useEffect(() => {
    if (autoTried.current || joined) return
    const fromQuery = normalizeRoomCode(searchParams.get('code') ?? '')
    const code = fromQuery.length === 4 ? fromQuery : 'FETE'
    autoTried.current = true
    void joinRoom(code)
  }, [searchParams, joined, joinRoom])

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(draft)
    if (code.length !== 4) return
    await joinRoom(code)
  }

  return (
    <main
      className={`checker theme-${state.themeColor} ${joined ? 'checker--live' : ''}`}
      data-theme={state.themeColor}
    >
      <header className="checker-bar">
        <Link className="brand-quiet" href="/">
          <MarketCrossMark className="brand-inline-cross" />
          Ancrum Fete Bingo
        </Link>
        <p className="checker-role">Checker</p>
        {joined ? (
          <p className="checker-meta">
            {state.called.length} called · {room}
          </p>
        ) : (
          <p className="checker-meta">Join hall room</p>
        )}
      </header>

      {!joined ? (
        <section className="join-panel">
          <h2>Checker pad</h2>
          <p>Scan the Checker QR on the Caller pad, or enter the hall code (usually <strong>FETE</strong>).</p>
          <form className="join-form" onSubmit={(e) => void onJoin(e)}>
            <input
              className="join-input"
              value={draft}
              onChange={(e) => setDraft(normalizeRoomCode(e.target.value))}
              placeholder="FETE"
              aria-label="Room code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              inputMode="text"
            />
            <button type="submit" className="btn btn-next" disabled={draft.length !== 4}>
              Open checker
            </button>
          </form>
          {roomStatus === 'connecting' && <p className="join-hint">Joining…</p>}
          {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
        </section>
      ) : (
        <div className="checker-stage">
          <section className="checker-board-wrap" aria-label="Called numbers board">
            <div className="board-frame board-frame--square checker-board-frame">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} />
            </div>
          </section>

          <aside className="checker-side" aria-live="polite">
            {checkCue ? (
              <p
                className={
                  checkCue === 'bingo' ? 'checker-cue checker-cue--bingo' : 'checker-cue checker-cue--full-house'
                }
                role="status"
              >
                {checkCue === 'bingo' ? 'Checking for Bingo (one line)' : 'Checking for Full House'}
              </p>
            ) : null}
            <div className="checker-hero">
              <p className="checker-label">Last called</p>
              <p className={`checker-number ${last ? 'checker-number--pop' : ''}`} key={last ?? 'empty'}>
                {last ?? '—'}
              </p>
              <p className="checker-count">{state.called.length} numbers called</p>
              {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
            </div>

            <section className="checker-called-list" aria-label="All called numbers, sorted">
              <p className="checker-list-kicker">All called · sorted</p>
              {calledSorted.length === 0 ? (
                <p className="checker-list-empty">No numbers yet — waiting for the Caller.</p>
              ) : (
                <ul className="checker-called-chips">
                  {calledSorted.map((n) => (
                    <li key={n} className={n === last ? 'checker-chip checker-chip--hot' : 'checker-chip'}>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </main>
  )
}
