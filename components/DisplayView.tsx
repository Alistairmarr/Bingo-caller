'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DirtyGirty } from './DirtyGirty'
import { MarketCrossMark } from './Emblems'
import { HallAlertBanner } from './HallAlert'
import { NumberBoard } from './NumberBoard'
import { RecentCalls } from './RecentCalls'
import { RoomQr } from './RoomQr'
import { THEME_LABELS } from './game/themes'
import { normalizeRoomCode } from './game/roomApi'
import { useBingoStore } from './game/store'
import { lastCalled } from './game/types'
import { useHallAlertSound } from './useHallAlertSound'

export function DisplayView() {
  const searchParams = useSearchParams()
  const { state, room, roomStatus, roomError, joinRoom } = useBingoStore({ role: 'display' })
  const [draft, setDraft] = useState('FETE')
  const autoTried = useRef(false)
  const last = lastCalled(state)
  const joined = !!room
  const girty = last === 30
  const showQr = joined && !!room && !state.joinHidden

  // TV speakers only — Bingo / Full House cues (not on Caller or phones)
  useHallAlertSound(state.hallAlert, joined)

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
      className={[
        'display',
        `theme-${state.themeColor}`,
        joined ? 'display--live' : '',
        showQr ? 'display--with-qr' : '',
        state.highContrast ? 'display--contrast' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-theme={state.themeColor}
    >
      <div className="display-atmosphere" aria-hidden />
      <header className="display-bar">
        <Link className="display-brand" href="/" aria-label="Ancrum Fete Bingo">
          <MarketCrossMark className="display-brand-mark" />
          <span className="display-brand-text">
            <span className="display-brand-fete">Ancrum Fete</span>
            <span className="display-brand-sub">Bingo · in aid of the village fete</span>
          </span>
        </Link>
        <p className="display-meta">
          {joined ? (
            <>
              <span className="display-count">{state.called.length} called</span>
              <span className="display-room">{room}</span>
            </>
          ) : (
            <span className="display-count">Join hall room</span>
          )}
        </p>
      </header>

      {!joined ? (
        <section className="join-panel">
          <h2>Enter the hall room code</h2>
          <p>
            Open Caller on the games-master tablet first — code is usually <strong>FETE</strong>.
          </p>
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
              Join display
            </button>
          </form>
          {roomStatus === 'connecting' && <p className="join-hint">Joining room…</p>}
          {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
        </section>
      ) : (
        <>
          <div className="display-live-body">
            <section className="display-board-wrap" aria-label="Called numbers board">
              <div className="board-frame board-frame--square">
                <NumberBoard mode={state.mode} called={state.called} highlight={last} />
              </div>
            </section>

            <aside className="display-side" aria-live="polite" aria-atomic="true">
              <div className="display-hero">
                <p className="display-label">
                  Last called
                  {roomStatus === 'live' ? '' : roomStatus === 'connecting' ? ' · linking…' : ''}
                </p>
                <p
                  className={`display-number ${last ? 'display-number--pop' : ''} ${girty ? 'display-number--girty' : ''}`}
                  key={last ?? 'empty'}
                >
                  {last ?? '—'}
                </p>
                {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
              </div>
              <RecentCalls called={state.called} limit={5} className="recent-calls--display" />
            </aside>
          </div>

          {showQr ? (
            <div
              className="display-qr-overlay"
              role="dialog"
              aria-label="Phone follow-along QR and next game colour"
            >
              <div className="display-qr-prep">
                <p className="display-next-game">
                  <span className="display-next-game-kicker">Next game</span>
                  <span className={`display-next-game-colour display-next-game-colour--${state.themeColor}`}>
                    {THEME_LABELS[state.themeColor]}
                  </span>
                </p>
                <RoomQr
                  code={room!}
                  size={900}
                  className="room-qr-wrap--hall room-qr-wrap--overlay"
                  label="Scan with your phone to follow along"
                />
              </div>
            </div>
          ) : null}

          <HallAlertBanner alert={state.hallAlert} size="hall" />
          <DirtyGirty trigger={girty} size="hall" />
        </>
      )}
    </main>
  )
}
