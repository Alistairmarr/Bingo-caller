'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DirtyGirty } from './DirtyGirty'
import { JuneTwelfth } from './JuneTwelfth'
import { MarketCrossMark } from './Emblems'
import { HallAlertBanner } from './HallAlert'
import { NumberBoard } from './NumberBoard'
import { RecentCalls } from './RecentCalls'
import { THEME_LABELS } from './game/themes'
import { normalizeRoomCode } from './game/roomApi'
import { useBingoStore } from './game/store'
import { lastCalled } from './game/types'

export function MobileView() {
  const searchParams = useSearchParams()
  const { state, room, roomStatus, roomError, joinRoom } = useBingoStore({ role: 'display' })
  const [draft, setDraft] = useState('')
  const autoTried = useRef(false)
  const last = lastCalled(state)
  const joined = !!room
  const girty = last === 30
  const june12 = last === 12
  const prepNextGame = joined && state.called.length === 0

  useEffect(() => {
    const fromQuery = normalizeRoomCode(searchParams.get('code') ?? '')
    if (fromQuery.length === 4) setDraft(fromQuery)
  }, [searchParams])

  useEffect(() => {
    if (autoTried.current || joined) return
    const fromQuery = normalizeRoomCode(searchParams.get('code') ?? '')
    if (fromQuery.length !== 4) return
    autoTried.current = true
    void joinRoom(fromQuery)
  }, [searchParams, joined, joinRoom])

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(draft)
    if (code.length !== 4) return
    await joinRoom(code)
  }

  return (
    <main
      className={`mobile theme-${state.themeColor} ${joined ? 'mobile--live' : ''}`}
      data-theme={state.themeColor}
    >
      <header className="mobile-bar">
        <Link className="brand-quiet" href="/">
          <MarketCrossMark className="brand-inline-cross" />
          Ancrum Fete Bingo
        </Link>
        {joined ? (
          <p className="mobile-meta">
            {state.called.length} called · {room}
          </p>
        ) : (
          <p className="mobile-meta">Follow along</p>
        )}
      </header>

      {!joined ? (
        <section className="join-panel join-panel--mobile">
          <h2>Join the hall game</h2>
          <p>Scan the TV QR, or enter the room code (usually <strong>FETE</strong>).</p>
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
              Follow along
            </button>
          </form>
          {roomStatus === 'connecting' && <p className="join-hint">Joining…</p>}
          {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
        </section>
      ) : prepNextGame ? (
        <section className="mobile-prep" aria-live="polite">
          <p className="mobile-prep-kicker">Next game</p>
          <p className={`mobile-prep-colour mobile-prep-colour--${state.themeColor}`}>
            {THEME_LABELS[state.themeColor]}
          </p>
          <p className="mobile-prep-hint">Get your card ready — waiting for the first number.</p>
          {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
        </section>
      ) : (
        <>
          <section className="mobile-hero" aria-live="polite" aria-atomic="true">
            <p className="mobile-label">Last called</p>
            <p
              className={`mobile-number ${last ? 'mobile-number--pop' : ''} ${girty ? 'display-number--girty' : ''}`}
              key={last ?? 'empty'}
            >
              {last ?? '—'}
            </p>
            {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
          </section>

          <RecentCalls called={state.called} limit={5} className="recent-calls--mobile" />

          <section className="mobile-board-wrap" aria-label="Called numbers">
            <div className="board-frame board-frame--compact board-frame--square">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} compact />
            </div>
          </section>

          <HallAlertBanner alert={state.hallAlert} />
          <DirtyGirty trigger={girty} />
          <JuneTwelfth trigger={june12} />
        </>
      )}
    </main>
  )
}
