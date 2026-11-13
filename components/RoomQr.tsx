'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

/** Phones scan this — opens the mobile follow-along surface. */
export function mobileJoinUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/mobile?code=${encodeURIComponent(code)}`
}

export function RoomQr({
  code,
  size = 128,
  className = '',
  label = 'Scan to follow on your phone',
}: {
  code: string
  size?: number
  className?: string
  label?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = mobileJoinUrl(code)
    void QRCode.toDataURL(url, {
      width: Math.max(size * 2, 512),
      margin: 2,
      // Always pure B&W — easier for phone cameras across a hall
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((next) => {
      if (!cancelled) setDataUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [code, size])

  return (
    <figure className={`room-qr-wrap ${className}`.trim()}>
      {dataUrl ? (
        <a className="room-qr-link" href={mobileJoinUrl(code)} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="room-qr"
            src={dataUrl}
            width={size}
            height={size}
            alt={`QR code to open mobile follow-along for room ${code}`}
          />
        </a>
      ) : (
        <div className="room-qr room-qr--loading" style={{ width: size, height: size }} aria-hidden />
      )}
      {label ? <figcaption className="room-qr-caption">{label}</figcaption> : null}
    </figure>
  )
}
