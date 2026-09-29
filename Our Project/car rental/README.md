# VRMS Mobile App

React Native (Expo) app for the Vehicle Rental Management System. This talks
to your real FastAPI backend — no fake data, everything you do in the app
actually happens in your MySQL database.

Verified before handoff: type-checked with zero errors, and successfully
bundled into a real Android JavaScript bundle (875 modules, no build errors).

## What's built (the priority screens)
- **Login** — real authentication against `/auth/login`
- **Dashboard** — live vehicle/booking counts from your database
- **Vehicle search** — searches your real fleet, filters as you type
- **Booking** — 3-step wizard (customer → dates → confirm), creates a real booking, VAT calculated server-side
- **Payment** — cash/card/EFT, records a real payment against the booking
- **Vehicle return** — shows an estimated penalty as you adjust fuel level, then submits to the server for the final calculated amount
- **Bookings list & Profile/logout** — round out the navigation

Role-based tabs adjust automatically based on who's logged in, same as your
original design brief.

## Before you run it: point the app at your backend

Open `src/config.ts` and set `API_BASE_URL` to wherever your backend is
actually running:

| Situation | Value to use |
|---|---|
| Android emulator on the same computer as the backend | `http://10.0.2.2:8000` (this is the default already set) |
| Physical Android phone, same Wi-Fi as your computer | `http://<your-computer's-IP>:8000` — find your IP on Windows with `ipconfig`, look for "IPv4 Address" (something like `192.168.1.42`) |
| Backend deployed somewhere online later | that server's real address |

**Important:** your backend's `uvicorn` needs to be reachable from other
devices, not just your own computer. If you only ever ran
`uvicorn app.main:app --reload`, it may only listen on `localhost`. Run it
with `--host 0.0.0.0` instead so your phone can reach it:
```
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0
```
Also make sure your computer's firewall isn't blocking port 8000, and that
your phone and computer are on the same Wi-Fi network.

## Running the app

```bash
npm install
npx expo start
```

This opens a QR code in your terminal/browser. Two ways to view the app:

1. **Easiest — Expo Go app**: install "Expo Go" from the Google Play Store on
   your Android phone, then scan the QR code from the terminal. The app loads
   straight onto your phone.
2. **Android emulator**: if you have Android Studio set up with an emulator
   running, press `a` in the terminal after `expo start` to launch it there.

## Project structure
```
src/
  api/client.ts          Every backend call lives here (login, vehicles, bookings, etc.)
  context/AuthContext.tsx Tracks who's logged in across the whole app
  navigation/             Screen routing, role-based tabs
  screens/                One file per screen
  components/             Reusable Button, Field, StatusBadge
  theme.ts                Colors matching the original design brief
  types/index.ts          TypeScript types matching the backend's data shapes
  config.ts               Backend URL - the one thing you'll edit most
```

## What's not built yet
- The remaining screens from the original 12-screen brief: registration, vehicle detail, rental contract/PDF, admin user management, reports, notifications
- Push notifications
- Offline support (the app currently requires a live connection to the backend)
- App icons / splash screen customization (using Expo defaults for now)

## If login or requests fail
- **"Could not reach the server..."** — the URL in `src/config.ts` doesn't
  match where your backend actually is, or the backend isn't running, or
  your phone/computer aren't on the same network.
- **401 Unauthorized right after logging in successfully** — this would be a
  real bug; the token isn't being sent. Check `src/api/client.ts`'s `request`
  function is attaching the `Authorization` header.
- **A screen shows "Could not load..."** — same root cause as above almost
  always: the app can't reach the backend. Check the backend terminal for
  incoming request logs to confirm whether requests are arriving at all.
