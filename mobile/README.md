# Compass mobile (scaffold)

iOS + Android shell for Compass, per `docs/CROSS_PLATFORM.md` — **one TypeScript core, thin
platform shells**. This directory is a scaffold (roadmap 4.4), not an installed app.

## What's here

- `App.tsx` — the Ask screen. Authenticates with the **same Google OIDC client** as the web
  app (via `expo-auth-session`), stores the Compass session token in `expo-secure-store`,
  and calls the **same `/api/ask`** endpoint. No retrieval or permission logic on device —
  the server owns the boundary.
- `app.json`, `package.json` — Expo config.

## Run it

```bash
cd mobile
npm install
EXPO_PUBLIC_COMPASS_API=https://<your-compass-server> npx expo start
```

Then press `i` (iOS simulator) or `a` (Android emulator), or scan the QR with Expo Go.

## What still needs wiring for a store build

- The `expo-auth-session` OIDC flow (redirect `compass://redirect` registered on the OAuth client)
- Apple Developer account ($99/yr) + Google Play ($25 one-time) for store submission
- Push notifications for "a grant you follow has a new report" (optional)

The shared retrieval core (`../src/retrieval`, `../src/core`) is pure TypeScript with no
Node built-ins in the hot path, so a future offline mode could bundle a small index — but
v1 is server-backed, like the web app.
