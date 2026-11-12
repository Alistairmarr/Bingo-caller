import Link from 'next/link'
import { CrossKeysMark, MarketCrossMark, VillageGreenScene } from './Emblems'

export function HomeView() {
  return (
    <main className="home">
      <div className="home-scene" aria-hidden>
        <VillageGreenScene className="home-scene-art" />
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
        <h1>On the green · village hall night</h1>
        <p className="lede">
          On the <strong>Pad</strong>, open Caller — one hall room with a big QR. On the{' '}
          <strong>TV</strong>, open Display and join. Phones in the hall can scan the QR to follow along.
        </p>
      </header>

      <nav className="home-actions" aria-label="Views">
        <Link className="launch launch-caller" href="/caller">
          <span className="launch-kicker">Pad · games master</span>
          <span className="launch-title">Caller</span>
          <span className="launch-hint">Creates a room code · Next · Undo · Clear</span>
        </Link>
        <Link className="launch launch-display" href="/display">
          <span className="launch-kicker">TV · hall screen</span>
          <span className="launch-title">Display</span>
          <span className="launch-hint">Join with the room code</span>
        </Link>
      </nav>

      <p className="home-footnote">
        Same browser / Try Live: Caller and Display still sync locally without a room if you open both tabs here.
      </p>
    </main>
  )
}
