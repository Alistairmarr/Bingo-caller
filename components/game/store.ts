'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearCalled, nextNumber, setMode, undoLast } from './logic'
import { createRoom, fetchRoom, pushRoom } from './roomApi'
import {
  CHANNEL_NAME,
  DEFAULT_STATE,
  ROOM_STORAGE_KEY,
  STORAGE_KEY,
  type BingoMode,
  type BingoState,
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
  const stateRef = useRef(state)
  stateRef.current = state
  const roomRef = useRef(room)
  roomRef.current = room

  const publishLocal = useCallback((next: BingoState) => {
    writeStored(next)
    getChannel()?.postMessage(next)
    setState(next)
  }, [])

  const publish = useCallback(
    async (next: BingoState) => {
      setState(next)
      writeStored(next)
      getChannel()?.postMessage(next)
      const code = roomRef.current
      if (code && role === 'caller') {
        try {
          await pushRoom(code, next)
          setRoomStatus('live')
          setRoomError(null)
        } catch (err) {
          setRoomStatus('error')
          setRoomError(err instanceof Error ? err.message : 'Room sync failed')
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
    setRoomStatus('connecting')

    const tick = async () => {
      try {
        const remote = await fetchRoom(room)
        if (cancelled) return
        if (!remote) {
          setRoomStatus('error')
          setRoomError('Room not found — check the code on the Pad')
          return
        }
        if ((remote.updatedAt ?? 0) >= (stateRef.current.updatedAt ?? 0)) {
          setState(remote)
          writeStored(remote)
        }
        setRoomStatus('live')
        setRoomError(null)
      } catch (err) {
        if (!cancelled) {
          setRoomStatus('error')
          setRoomError(err instanceof Error ? err.message : 'Could not reach room')
        }
      }
    }

    void tick()
    const id = window.setInterval(tick, 600)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [role, room])

  const ensureCallerRoom = useCallback(async () => {
    if (roomRef.current) return roomRef.current
    setRoomStatus('connecting')
    try {
      // Single hall room (server returns FETE / existing)
      const created = await createRoom(stateRef.current)
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
      return created.code
    } catch (err) {
      setRoomStatus('error')
      setRoomError(err instanceof Error ? err.message : 'Could not open hall room')
      return null
    }
  }, [])

  const joinRoom = useCallback(async (code: string) => {
    setRoomStatus('connecting')
    try {
      const remote = await fetchRoom(code)
      if (!remote) {
        setRoomStatus('error')
        setRoomError('Room not found')
        return false
      }
      setRoom(code)
      roomRef.current = code
      setState(remote)
      writeStored(remote)
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
    void publish(nextNumber(stateRef.current))
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

  return {
    state,
    room,
    roomStatus,
    roomError,
    callNext,
    undo,
    clear,
    changeMode,
    ensureCallerRoom,
    joinRoom,
    publishLocal,
  }
}
