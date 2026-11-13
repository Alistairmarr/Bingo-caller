'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearCalled,
  clearHallAlert,
  nextNumber,
  setHallAlert,
  setHighContrast,
  setJoinHidden,
  setMode,
  startNewGame,
  undoLast,
} from './logic'
import { CallerPinError, createRoom, fetchRoom, pushRoom } from './roomApi'
import {
  CHANNEL_NAME,
  DEFAULT_STATE,
  ROOM_STORAGE_KEY,
  STORAGE_KEY,
  parseHallAlert,
  parseThemeColor,
  type BingoMode,
  type BingoState,
  type HallAlertKind,
  type ThemeColor,
} from './types'

function readStored(): BingoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, updatedAt: Date.now() }
    const parsed = JSON.parse(raw) as Partial<BingoState>
    if (parsed.mode !== 75 && parsed.mode !== 90) return { ...DEFAULT_STATE, updatedAt: Date.now() }
    if (!Array.isArray(parsed.called)) return { ...DEFAULT_STATE, updatedAt: Date.now() }
    return {
      mode: parsed.mode,
      called: parsed.called.filter((n): n is number => typeof n === 'number'),
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

export type SyncRole = 'caller' | 'display' | 'none'

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
    if (role !== 'display' || !room) return
    let cancelled = false
    let inFlight = false
    let timer: number | null = null
    setRoomStatus('connecting')

    // ~200ms Display poll + ETag 304s — snappier than 600ms without long-lived sockets.
    const POLL_MS = 200

    const schedule = () => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        void tick()
      }, POLL_MS)
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
          setRoomStatus('error')
          setRoomError('Room not found — check the code on the Pad')
          return
        }
        if (remote.status === 'ok') {
          if ((remote.state.updatedAt ?? 0) >= (stateRef.current.updatedAt ?? 0)) {
            setState(remote.state)
            writeStored(remote.state)
          }
        }
        setRoomStatus('live')
        setRoomError(null)
      } catch (err) {
        if (!cancelled) {
          setRoomStatus('error')
          setRoomError(err instanceof Error ? err.message : 'Could not reach room')
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

  const clear = useCallback(() => {
    void publish(clearCalled(stateRef.current))
  }, [publish])

  const changeMode = useCallback(
    (mode: BingoMode) => {
      void publish(setMode(stateRef.current, mode))
    },
    [publish],
  )

  const changeJoinHidden = useCallback(
    (hidden: boolean) => {
      void publish(setJoinHidden(stateRef.current, hidden))
    },
    [publish],
  )

  const signalHallAlert = useCallback(
    (kind: HallAlertKind) => {
      void publish(setHallAlert(stateRef.current, kind))
    },
    [publish],
  )

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
    clear,
    changeMode,
    changeJoinHidden,
    signalHallAlert,
    dismissHallAlert,
    changeHighContrast,
    beginNewGame,
    ensureCallerRoom,
    joinRoom,
    publishLocal,
  }
}
