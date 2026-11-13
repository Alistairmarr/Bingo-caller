'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DirtyGirty } from './DirtyGirty'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
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
  const recent = [...state.called].slice(-8).reverse()

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
    <main className={`mobile ${joined ? 'mobile--live' : ''}`}>
      <header className="mobile-bar">
        <Link className="brand-quiet" href="/">
          <MarketCrossMark className="brand-inline-cross" />
          Ancrum Fete Bingo
        </Link>
        {joined ? (
          <p className="mobile-meta">
            {state.mode}-ball · {state.called.length} called · {room}
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

          {recent.length > 0 ? (
            <section className="mobile-recent" aria-label="Recent calls">
              <p className="mobile-recent-label">Recent</p>
              <ol className="mobile-recent-list">
                {recent.map((n, i) => (
                  <li key={`${n}-${i}`} className={i === 0 ? 'mobile-recent-item mobile-recent-item--hot' : 'mobile-recent-item'}>
                    {n}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mobile-board-wrap" aria-label="Called numbers">
            <div className="board-frame board-frame--compact">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} compact />
            </div>
          </section>

          <DirtyGirty trigger={girty} />
        </>
      )}
    </main>
  )
}
