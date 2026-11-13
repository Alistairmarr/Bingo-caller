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
        <h1>Bright hall night · Pad Caller · TV Display</h1>
        <p className="lede">Pick a view — one hall room, big QR, numbers the whole green can see.</p>
      </header>

      <nav className="home-actions" aria-label="Views">
        <Link className="launch launch-caller" href="/caller">
          <span className="launch-kicker">Pad · games master</span>
          <span className="launch-title">Caller</span>
          <span className="launch-hint">Unlock with PIN · Next · Undo · Clear</span>
        </Link>
        <Link className="launch launch-display" href="/display">
          <span className="launch-kicker">TV · hall screen</span>
          <span className="launch-title">Display</span>
          <span className="launch-hint">Join with the room code</span>
        </Link>
      </nav>

      <p className="home-footnote">
        Same browser / Try Live: open both tabs here to sync locally without a room.
      </p>
    </main>
  )
}
