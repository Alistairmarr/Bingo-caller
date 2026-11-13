'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export type RoomQrPath = 'mobile' | 'checker'

/** Phones scan this — opens the mobile follow-along surface. */
export function mobileJoinUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/mobile?code=${encodeURIComponent(code)}`
}

/** Checker pad QR — opens the quiet called-numbers check screen. */
export function checkerJoinUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/checker?code=${encodeURIComponent(code)}`
}

function joinUrlFor(path: RoomQrPath, code: string, origin?: string): string {
  return path === 'checker' ? checkerJoinUrl(code, origin) : mobileJoinUrl(code, origin)
}

export function RoomQr({
  code,
  size = 128,
  className = '',
  label = 'Scan to follow on your phone',
  path = 'mobile',
}: {
  code: string
  size?: number
  className?: string
  label?: string
  /** Destination surface encoded in the QR (default: audience mobile). */
  path?: RoomQrPath
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const href = joinUrlFor(path, code)

  useEffect(() => {
    let cancelled = false
    const url = joinUrlFor(path, code)
    void QRCode.toDataURL(url, {
      width: Math.max(size * 2, 512),
      margin: 3,
      type: 'image/png',
      // Always pure black modules on pure white — never theme-tinted
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((next) => {
      if (!cancelled) setDataUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [code, size, path])

  const alt =
    path === 'checker'
      ? `QR code to open checker pad for room ${code}`
      : `QR code to open mobile follow-along for room ${code}`

  return (
    <figure className={`room-qr-wrap ${className}`.trim()}>
      {dataUrl ? (
        <a className="room-qr-link" href={href} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="room-qr"
            src={dataUrl}
            width={size}
            height={size}
            alt={alt}
            style={{ backgroundColor: '#ffffff' }}
            draggable={false}
          />
        </a>
      ) : (
        <div className="room-qr room-qr--loading" style={{ width: size, height: size }} aria-hidden />
      )}
      {label ? <figcaption className="room-qr-caption">{label}</figcaption> : null}
    </figure>
  )
}
