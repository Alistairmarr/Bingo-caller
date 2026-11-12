'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function displayJoinUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/display?code=${encodeURIComponent(code)}`
}

export function RoomQr({ code, size = 128 }: { code: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = displayJoinUrl(code)
    void QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      color: { dark: '#1c2419', light: '#ece7db' },
      errorCorrectionLevel: 'M',
    }).then((next) => {
      if (!cancelled) setDataUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [code, size])

  if (!dataUrl) {
    return <div className="room-qr room-qr--loading" style={{ width: size, height: size }} aria-hidden />
  }

  return (
    <a className="room-qr-link" href={displayJoinUrl(code)} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="room-qr"
        src={dataUrl}
        width={size}
        height={size}
        alt={`QR code to open Display for room ${code}`}
      />
    </a>
  )
}
