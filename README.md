# Ancrum Fete Bingo

Dual-screen village-hall bingo for the **Ancrum Fete Committee**.

- **Pad → Caller** creates a short room code
- **TV / Fire Stick browser → Display** joins with that code
- Room sync via Next.js `/api/rooms` (Postgres when `DATABASE_URL` is set; in-memory PGlite locally)
- Same-browser BroadcastChannel + localStorage fallback for demos

## Develop

```bash
npm install
# ensure DATABASE_URL is unset so local uses PGlite
env -u DATABASE_URL npm run dev
```

App: http://127.0.0.1:3000/

## Build

```bash
npm run build
npm start
```

`cursor-app.json` requests a platform Postgres database for Cursor publish. Never commit `DATABASE_URL`.

## Caller PIN

Claiming / reclaiming Caller control requires a short PIN (`CALLER_PIN`). Display and QR stay open without it.

- Local / smoke default when unset: `fete`
- Published app: bind `CALLER_PIN` in Cursor secrets (Pad enters it once; token stays in sessionStorage)

```bash
# optional override for local
CALLER_PIN=your-pin env -u DATABASE_URL npm start
```

## Smoke test

With the app running:

```bash
npm run smoke
npm run smoke:security
```
