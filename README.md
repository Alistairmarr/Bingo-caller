# Ancrum Fete Bingo

Dual-screen village-hall bingo for the **Ancrum Fete Committee**.

- **Pad → Caller** creates a short room code
- **TV / Fire Stick browser → Display** joins with that code
- Room sync via Next.js `/api/rooms` (Postgres when `DATABASE_URL` is set; in-memory PGlite locally)
- Same-browser BroadcastChannel + localStorage fallback for demos

## Develop

```bash
npm install
# CALLER_PIN is required to claim Caller; DATABASE_URL unset → local PGlite
CALLER_PIN=your-local-pin env -u DATABASE_URL npm run dev
```

App: http://127.0.0.1:3000/

## Build

```bash
CALLER_PIN=your-local-pin env -u DATABASE_URL npm run build
CALLER_PIN=your-local-pin env -u DATABASE_URL npm start
```

`cursor-app.json` requests a platform Postgres database for Cursor publish. Never commit `DATABASE_URL` or `CALLER_PIN`.

## Caller PIN

Claiming / reclaiming Caller control requires `CALLER_PIN` from the environment (Cursor app secret when published). There is **no** shipped default — if unset, Caller claim is refused. Display and QR stay open without it.

Pad enters the PIN once; the Caller token is kept in sessionStorage.

## Smoke test

With the app running **and** `CALLER_PIN` set in the test environment (same value the server was started with):

```bash
CALLER_PIN=your-local-pin npm run smoke
CALLER_PIN=your-local-pin npm run smoke:security
```
