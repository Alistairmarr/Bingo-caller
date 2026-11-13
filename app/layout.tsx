import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ancrum Fete Bingo',
  description: 'Ancrum Fete Bingo — dual-screen village hall caller with room-code sync',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#12964c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rokkitt:wght@600;700;800&family=Source+Sans+3:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-root">{children}</div>
      </body>
    </html>
  )
}
