'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DirtyGirty } from './DirtyGirty'
import { MarketCrossMark } from './Emblems'
import { NumberBoard } from './NumberBoard'
import { RoomQr } from './RoomQr'
import { normalizeRoomCode } from './game/roomApi'
import { useBingoStore } from './game/store'
import { lastCalled } from './game/types'

const QR_HIDDEN_KEY = 'ancrum-fete-bingo-display-qr-hidden'

export function DisplayView() {
  const searchParams = useSearchParams()
  const { state, room, roomStatus, roomError, joinRoom } = useBingoStore({ role: 'display' })
  const [draft, setDraft] = useState('')
  const [qrHidden, setQrHidden] = useState(false)
  const autoTried = useRef(false)
  const last = lastCalled(state)
  const joined = !!room
  const girty = last === 30

  useEffect(() => {
    try {
      setQrHidden(sessionStorage.getItem(QR_HIDDEN_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

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

  const setQrHiddenPersist = (hidden: boolean) => {
    setQrHidden(hidden)
    try {
      sessionStorage.setItem(QR_HIDDEN_KEY, hidden ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(draft)
    if (code.length !== 4) return
    await joinRoom(code)
  }

  return (
    <main className={`display ${qrHidden || !joined ? '' : 'display--with-qr'}`}>
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
              {qrHidden ? (
                <button type="button" className="btn btn-ghost display-qr-toggle" onClick={() => setQrHiddenPersist(false)}>
                  Show QR
                </button>
              ) : (
                <button type="button" className="btn btn-ghost display-qr-toggle" onClick={() => setQrHiddenPersist(true)}>
                  Hide QR
                </button>
              )}
            </>
          ) : (
            <span className="display-count">Join hall room</span>
          )}
        </p>
      </header>

      {!joined ? (
        <section className="join-panel">
          <h2>Enter the hall room code</h2>
          <p>Open Caller on the games-master tablet first — code is usually <strong>FETE</strong>, or scan the QR.</p>
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
          <p className="join-hint">
            Same browser demo: open Caller in another tab — local sync still works without joining.
          </p>
        </section>
      ) : (
        <>
          <section className="display-stage" aria-live="polite" aria-atomic="true">
            <div className="display-hero">
              <p className="display-label">
                Last called
                {roomStatus === 'live' ? ' · live' : roomStatus === 'connecting' ? ' · linking…' : ''}
              </p>
              <p
                className={`display-number ${last ? 'display-number--pop' : ''} ${girty ? 'display-number--girty' : ''}`}
                key={last ?? 'empty'}
              >
                {last ?? '—'}
              </p>
              {roomStatus === 'error' && <p className="join-error">{roomError}</p>}
            </div>
            {!qrHidden && room ? (
              <div className="display-qr-panel">
                <RoomQr code={room} size={480} className="room-qr-wrap--hall" label="Scan to follow along" />
              </div>
            ) : null}
          </section>

          <section className="display-board-wrap" aria-label="Called numbers board">
            <div className="board-frame">
              <NumberBoard mode={state.mode} called={state.called} highlight={last} />
            </div>
          </section>

          <DirtyGirty trigger={girty} />
        </>
      )}
    </main>
  )
}
