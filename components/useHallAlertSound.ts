'use client'

import { useEffect, useRef } from 'react'
import type { HallAlert } from './game/types'

const SOUND: Record<'bingo' | 'full_house', string> = {
  bingo: '/sounds/bingo.wav',
  full_house: '/sounds/full-house.wav',
}

/**
 * TV Display only — play a distinct cue when Bingo / Full House appears.
 * Silent on Caller/Mobile; safe if the browser blocks autoplay until a tap.
 */
export function useHallAlertSound(alert: HallAlert | null, enabled: boolean) {
  const lastIdRef = useRef<number | null>(null)
  const unlockedRef = useRef(false)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const unlock = () => {
      unlockedRef.current = true
      // Warm both cues so Bingo / Full House start promptly on the TV
      for (const src of Object.values(SOUND)) {
        const warm = new Audio(src)
        warm.preload = 'auto'
        warm.load()
      }
    }
    // Fire Stick / TV browsers often need one gesture before audio works
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    // Best-effort silent unlock for players that allow it without a tap
    const probe = new Audio(SOUND.bingo)
    probe.volume = 0.001
    void probe.play().then(() => {
      probe.pause()
      unlockedRef.current = true
    }).catch(() => {
      /* wait for a remote/OK press on the Display */
    })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !alert) {
      if (!alert) lastIdRef.current = null
      return
    }
    if (lastIdRef.current === alert.id) return
    lastIdRef.current = alert.id

    const audio = new Audio(SOUND[alert.kind])
    audio.preload = 'auto'
    audio.volume = 0.9
    void audio.play().catch(() => {
      /* autoplay blocked until the Display page gets a tap — press OK once on the TV */
    })
  }, [alert, enabled])
}
