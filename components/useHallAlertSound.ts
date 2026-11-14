'use client'

import { useEffect, useRef } from 'react'
import type { HallAlert } from './game/types'

const SOUND: Record<'bingo' | 'full_house', string> = {
  bingo: '/sounds/bingo.wav',
  full_house: '/sounds/full-house.wav',
}

type Players = Record<'bingo' | 'full_house', HTMLAudioElement>

/**
 * TV Display only — play a clear Bingo / Full House announcement when the alert appears.
 * Silent on Caller/Mobile. Reuses unlocked Audio elements so every claim replays (not only the first).
 */
export function useHallAlertSound(alert: HallAlert | null, enabled: boolean) {
  const lastIdRef = useRef<number | null>(null)
  const unlockedRef = useRef(false)
  const playersRef = useRef<Players | null>(null)

  const ensurePlayers = (): Players => {
    if (!playersRef.current) {
      const bingo = new Audio(SOUND.bingo)
      const fullHouse = new Audio(SOUND.full_house)
      bingo.preload = 'auto'
      fullHouse.preload = 'auto'
      bingo.volume = 0.95
      fullHouse.volume = 0.95
      playersRef.current = { bingo, full_house: fullHouse }
    }
    return playersRef.current
  }

  const unlockPlayers = () => {
    unlockedRef.current = true
    const players = ensurePlayers()
    for (const audio of Object.values(players)) {
      audio.preload = 'auto'
      // Silent play/pause keeps the element in an unlocked gesture chain on TV browsers
      const prev = audio.volume
      audio.volume = 0.001
      void audio
        .play()
        .then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.volume = prev
        })
        .catch(() => {
          audio.volume = prev
        })
    }
  }

  const playAlert = (kind: 'bingo' | 'full_house') => {
    const players = ensurePlayers()
    const audio = players[kind]
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      /* ignore seek errors while loading */
    }
    audio.volume = 0.95
    void audio.play().catch(() => {
      // Some WebViews drop the element after one play — recreate once and retry
      const fresh = new Audio(SOUND[kind])
      fresh.preload = 'auto'
      fresh.volume = 0.95
      players[kind] = fresh
      void fresh.play().catch(() => {
        /* still blocked until Display gets a remote/OK press */
      })
    })
  }

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    ensurePlayers()
    const onGesture = () => unlockPlayers()
    window.addEventListener('pointerdown', onGesture, { once: true })
    window.addEventListener('keydown', onGesture, { once: true })

    // Best-effort unlock without a tap (some Fire Stick / TV players allow it)
    const probe = ensurePlayers().bingo
    const prev = probe.volume
    probe.volume = 0.001
    void probe
      .play()
      .then(() => {
        probe.pause()
        probe.currentTime = 0
        probe.volume = prev
        unlockedRef.current = true
      })
      .catch(() => {
        probe.volume = prev
      })

    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !alert) {
      if (!alert) lastIdRef.current = null
      return
    }
    if (lastIdRef.current === alert.id) return
    lastIdRef.current = alert.id
    playAlert(alert.kind)
  }, [alert, enabled])
}
