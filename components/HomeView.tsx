import Link from 'next/link'
import { CrossKeysMark, MarketCrossMark } from './Emblems'

export function HomeView() {
  return (
    <main className="home">
      <div className="home-photo" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="home-photo-img" src="/home-hero.jpg" alt="" />
      </div>
      <div className="home-veil" aria-hidden />

      <header className="home-brand">
        <div className="home-emblems" aria-hidden>
          <MarketCrossMark className="home-cross" />
        </div>
        <p className="brand-place">
          <CrossKeysMark className="place-keys" />
          Ancrum Fete Committee · Scottish Borders
        </p>
        <p className="brand-mark">Ancrum Fete Bingo</p>
        <h1>Pad Caller · TV Display · phone follow-along</h1>
        <p className="lede">Caller on the Pad, big board on the TV — phones scan the TV QR.</p>
      </header>

      <nav className="home-actions" aria-label="Views">
        <Link className="launch launch-caller" href="/caller">
          <span className="launch-kicker">Pad · games master</span>
          <span className="launch-title">Caller</span>
          <span className="launch-hint">Unlock with PIN · Next · Undo · Clear</span>
        </Link>
        <Link className="launch launch-display" href="/display">
          <span className="launch-kicker">TV · 4K hall screen</span>
          <span className="launch-title">Display</span>
          <span className="launch-hint">Huge number · board · phone QR</span>
        </Link>
      </nav>

      <p className="home-footnote">
        Phones: scan the QR on Display (opens Mobile). Same-browser demo: open Caller + Display tabs here.
      </p>
    </main>
  )
}
