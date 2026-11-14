'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearHallAlert,
  nextNumber,
  setHallAlert,
  setHighContrast,
  setJoinHidden,
  startNewGame,
  undoLast,
} from './logic'
import { CallerPinError, createRoom, fetchRoom, pushCheckerHallAlert, pushRoom } from './roomApi'
import {
  CHANNEL_NAME,
  DEFAULT_STATE,
  ROOM_STORAGE_KEY,
  STORAGE_KEY,
  parseBingoMode,
  parseHallAlert,
  parseThemeColor,
  type BingoState,
  type HallAlertKind,
  type ThemeColor,
} from './types'

function readStored(): BingoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, updatedAt: Date.now() }
    const parsed = JSON.parse(raw) as Partial<BingoState>
    if (!Array.isArray(parsed.called)) return { ...DEFAULT_STATE, updatedAt: Date.now() }
    return {
      mode: parseBingoMode(parsed.mode),
      called: parsed.called.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 90),
      joinHidden: parsed.joinHidden === true,
      hallAlert: parseHallAlert(parsed.hallAlert),
      highContrast: parsed.highContrast === true,
      themeColor: parseThemeColor(parsed.themeColor),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return { ...DEFAULT_STATE, updatedAt: Date.now() }
  }
}

function writeStored(state: BingoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/** `display` = TV; `mobile` = audience phones (slower poll); `checker` = claim pad. */
export type SyncRole = 'caller' | 'display' | 'mobile' | 'checker' | 'none'

function pollTuning(role: SyncRole): { baseMs: number; maxBackoffMs: number } {
  switch (role) {
    case 'mobile':
      // Audience phones: ~1s is fine for follow-along; keeps hall DB load down
      return { baseMs: 1000, maxBackoffMs: 8000 }
    case 'caller':
      return { baseMs: 400, maxBackoffMs: 1500 }
    case 'display':
    case 'checker':
      // TV + Checker stay snappy (~200ms ETag)
      return { baseMs: 200, maxBackoffMs: 1500 }
    default:
      return { baseMs: 1000, maxBackoffMs: 4000 }
  }
}

export function useBingoStore(opts: { role: SyncRole; roomCode?: string | null } = { role: 'none' }) {
  const { role, roomCode = null } = opts
  const [state, setState] = useState<BingoState>(() =>
    typeof window === 'undefined' ? DEFAULT_STATE : readStored(),
  )
  const [room, setRoom] = useState<string | null>(roomCode)
  const [roomStatus, setRoomStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle')
  const [roomError, setRoomError] = useState<string | null>(null)
  const [needsCallerPin, setNeedsCallerPin] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const roomRef = useRef(room)
  roomRef.current = room
  const needsPinRef = useRef(false)
  /** Blocks rapid Next double-fires before React re-renders / room PUT returns. */
  const nextBusyUntilRef = useRef(0)

  const publishLocal = useCallback((next: BingoState) => {
    writeStored(next)
    getChannel()?.postMessage(next)
    setState(next)
  }, [])

  const publish = useCallback(
    async (next: BingoState) => {
      // Keep ref in sync immediately so a second Next in the same tick cannot reuse stale called[]
      stateRef.current = next
      setState(next)
      writeStored(next)
      getChannel()?.postMessage(next)
      const code = roomRef.current
      if (code && role === 'caller') {
        try {
          const confirmed = await pushRoom(code, next)
          stateRef.current = confirmed
          setState(confirmed)
          writeStored(confirmed)
          setRoomStatus('live')
          setRoomError(null)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Room sync failed'
          setRoomStatus('error')
          setRoomError(message)
          if (/Caller (token missing|control lost|PIN)/i.test(message)) {
            needsPinRef.current = true
            setNeedsCallerPin(true)
          }
        }
      }
    },
    [role],
  )

  useEffect(() => {
    const ch = getChannel()
    const onMessage = (event: MessageEvent<BingoState>) => {
      const incoming = event.data
      if (!incoming || typeof incoming !== 'object') return
      if ((incoming.updatedAt ?? 0) < (stateRef.current.updatedAt ?? 0)) return
      setState(incoming)
      writeStored(incoming)
    }
    ch?.addEventListener('message', onMessage)

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const incoming = JSON.parse(e.newValue) as BingoState
        if ((incoming.updatedAt ?? 0) < (stateRef.current.updatedAt ?? 0)) return
        setState(incoming)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      ch?.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    // Polling surfaces: TV Display, Mobile follow-along, Checker, and Caller (for Checker claims).
    const polls =
      role === 'display' || role === 'mobile' || role === 'checker' || role === 'caller'
    if (!polls || !room) return
    let cancelled = false
    let inFlight = false
    let timer: number | null = null
    const showsJoinStatus = role === 'display' || role === 'mobile' || role === 'checker'
    if (showsJoinStatus) setRoomStatus('connecting')

    const { baseMs: BASE_POLL_MS, maxBackoffMs } = pollTuning(role)
    let pollMs = BASE_POLL_MS

    const schedule = () => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        void tick()
      }, pollMs)
    }

    const tick = async () => {
      if (cancelled || inFlight) {
        schedule()
        return
      }
      inFlight = true
      try {
        const remote = await fetchRoom(room)
        if (cancelled) return
        if (remote.status === 'missing') {
          if (showsJoinStatus) {
            setRoomStatus('error')
            setRoomError('Room not found — check the code on the Pad')
          }
          return
        }
        if (remote.status === 'rate_limited') {
          // Quiet backoff — mobiles stretch further so pad/TV stay preferred
          pollMs = Math.min(pollMs * 2, maxBackoffMs)
          return
        }
        pollMs = BASE_POLL_MS
        if (remote.status === 'ok') {
          if ((remote.state.updatedAt ?? 0) >= (stateRef.current.updatedAt ?? 0)) {
            setState(remote.state)
            writeStored(remote.state)
          }
        }
        if (showsJoinStatus) {
          setRoomStatus('live')
          setRoomError(null)
        }
      } catch (err) {
        if (!cancelled && showsJoinStatus) {
          const message = err instanceof Error ? err.message : 'Could not reach room'
          if (message === 'rate_limited') {
            pollMs = Math.min(pollMs * 2, maxBackoffMs)
          } else {
            setRoomStatus('error')
            setRoomError(message)
          }
        }
      } finally {
        inFlight = false
        schedule()
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [role, room])

  const ensureCallerRoom = useCallback(async (callerPin?: string) => {
    if (roomRef.current && !needsPinRef.current && !callerPin) return roomRef.current
    setRoomStatus('connecting')
    try {
      // Single hall room — PIN required to mint/reclaim; matching token resumes without PIN
      const created = await createRoom(stateRef.current, callerPin)
      setRoom(created.code)
      roomRef.current = created.code
      try {
        localStorage.setItem(ROOM_STORAGE_KEY, created.code)
        sessionStorage.setItem(ROOM_STORAGE_KEY, created.code)
      } catch {
        /* ignore */
      }
      setState(created.state)
      writeStored(created.state)
      setRoomStatus('live')
      setRoomError(null)
      needsPinRef.current = false
      setNeedsCallerPin(false)
      return created.code
    } catch (err) {
      if (err instanceof CallerPinError) {
        needsPinRef.current = true
        setNeedsCallerPin(true)
        setRoomStatus('error')
        setRoomError(err.message)
        return null
      }
      setRoomStatus('error')
      setRoomError(err instanceof Error ? err.message : 'Could not open hall room')
      return null
    }
  }, [])

  const joinRoom = useCallback(async (code: string) => {
    setRoomStatus('connecting')
    try {
      const remote = await fetchRoom(code)
      if (remote.status !== 'ok') {
        setRoomStatus('error')
        setRoomError('Room not found')
        return false
      }
      setRoom(code)
      roomRef.current = code
      setState(remote.state)
      writeStored(remote.state)
      try {
        localStorage.setItem(ROOM_STORAGE_KEY, code)
      } catch {
        /* ignore */
      }
      setRoomStatus('live')
      setRoomError(null)
      return true
    } catch (err) {
      setRoomStatus('error')
      setRoomError(err instanceof Error ? err.message : 'Could not join')
      return false
    }
  }, [])

  const callNext = useCallback(() => {
    const now = Date.now()
    if (now < nextBusyUntilRef.current) return
    const prev = stateRef.current
    const next = nextNumber(prev)
    if (next.called.length === prev.called.length) return
    nextBusyUntilRef.current = now + 1100
    void publish(next)
  }, [publish])

  const undo = useCallback(() => {
    void publish(undoLast(stateRef.current))
  }, [publish])

  const changeJoinHidden = useCallback(
    (hidden: boolean) => {
      void publish(setJoinHidden(stateRef.current, hidden))
    },
    [publish],
  )

  const signalHallAlert = useCallback(
    (kind: HallAlertKind) => {
      void publish(setHallAlert(stateRef.current, kind, 'caller'))
    },
    [publish],
  )

  /** Checker raises a claim — same hallAlert path, source=checker (no Caller token). */
  const signalCheckerHallAlert = useCallback(async (kind: HallAlertKind) => {
    const code = roomRef.current
    if (!code) return
    const optimistic = setHallAlert(stateRef.current, kind, 'checker')
    stateRef.current = optimistic
    setState(optimistic)
    writeStored(optimistic)
    getChannel()?.postMessage(optimistic)
    try {
      const confirmed = await pushCheckerHallAlert(code, kind)
      stateRef.current = confirmed
      setState(confirmed)
      writeStored(confirmed)
      setRoomStatus('live')
      setRoomError(null)
    } catch (err) {
      setRoomStatus('error')
      setRoomError(err instanceof Error ? err.message : 'Could not raise claim')
    }
  }, [])

  const dismissHallAlert = useCallback(() => {
    void publish(clearHallAlert(stateRef.current))
  }, [publish])

  const changeHighContrast = useCallback(
    (on: boolean) => {
      void publish(setHighContrast(stateRef.current, on))
    },
    [publish],
  )

  const beginNewGame = useCallback(
    (themeColor: ThemeColor) => {
      void publish(startNewGame(stateRef.current, themeColor))
    },
    [publish],
  )

  return {
    state,
    room,
    roomStatus,
    roomError,
    needsCallerPin,
    callNext,
    undo,
    changeJoinHidden,
    signalHallAlert,
    signalCheckerHallAlert,
    dismissHallAlert,
    changeHighContrast,
    beginNewGame,
    ensureCallerRoom,
    joinRoom,
    publishLocal,
  }
}
