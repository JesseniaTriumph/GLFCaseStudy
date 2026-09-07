# Compass — Cross-Platform Strategy (Web · iOS · Android)

Compass is used at a desk (renewal prep, board memos) and on a phone (a question between
meetings, a site visit, a quick "did we fund them?" before a call). The experience must be
coherent across all three, and it must be **one codebase philosophy** so a small team can
maintain it.

---

## Approach: shared core, thin platform shells

```
                         ┌──────────────────────────────┐
                         │  SHARED (TypeScript)         │
                         │  • API client (/ask, dossier)│
                         │  • answer/citation types     │
                         │  • Deep-dive rendering model  │
                         │  • design tokens (light/dark) │
                         │  • formatting, i18n (en/es)   │
                         └───────────┬──────────────────┘
              ┌──────────────────────┼──────────────────────┐
     ┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
     │ Web (React+Vite) │   │ PWA (same build) │   │ iOS + Android    │
     │ desktop-first    │   │ installable,     │   │ Expo / React     │
     │ responsive       │   │ offline shell    │   │ Native (v2)      │
     └──────────────────┘   └──────────────────┘   └──────────────────┘
```

**The retrieval, permission, and answer logic never live in the client** — they're in the
query service. Clients only render answers and collect input. This keeps the security
boundary server-side on every platform.

---

## Phasing

| Phase | Platform | What ships |
|---|---|---|
| **v1** | **Responsive web + PWA** | One React/Vite app. Desktop layout (two-pane: answer + sources rail). Mobile layout (stacked, sources as a sheet). Installable PWA with an offline shell (cached UI; queries need connectivity). Covers "on my phone" for 90% of cases without a second codebase. |
| **v2** | **Expo (iOS + Android)** | Native app sharing the TS core and design tokens. Adds: native auth (Google Sign-In SDK), biometric unlock for the session, share-sheet ("ask Compass about this"), push for "your saved question has a new answer after last night's sync." |
| **v2+** | Slack / Zoom app | Answer bot where the team already works (from the strategy doc Phase 4). |

Rationale: a 21-person foundation does not need three native apps on day one. A good PWA
buys the mobile use cases immediately; native comes when adoption justifies it.

---

## Responsive layout rules

| Breakpoint | Layout |
|---|---|
| ≥ 1024px (desktop) | Two-pane: answer column (max ~68ch) + docked sources & coverage rail. Deep dive inline below the answer. Dossier full-width with a 4-stat row. |
| 640–1023px (tablet) | Single column. Sources rail collapses to a "4 sources" button that opens a panel. |
| < 640px (phone) | Single column. Answer first. "Sources" and "Deep dive" are bottom sheets. Ask box is sticky at the bottom. Citations open the source in an in-app browser / the source's own app if installed. |

## Platform-specific concerns

| Concern | Web / PWA | iOS / Android |
|---|---|---|
| Auth | OIDC redirect; session cookie | Google Sign-In SDK → same ID-token verify server-side; token in the Keychain / Keystore; optional biometric to resume |
| Deep-link citations | `#:~:text=` fragment opens the doc in a new tab with the passage highlighted | Open the source's native app via universal/app links if installed (Drive, Airtable), else in-app browser with the fragment |
| Offline | UI shell cached; a clear "needs connection to answer" state | Same; plus cache the last N answers read, read-only |
| Cost / rate control | Per-user budget enforced server-side (client can't bypass) | Same — enforcement is server-side regardless of platform |
| Accessibility | WCAG 2.1 AA; keyboard nav; visible focus; theme-aware | Platform a11y APIs (VoiceOver / TalkBack); Dynamic Type; 44pt touch targets |
| Updates | Instant (web deploy) | App Store / Play review cadence — keep business logic server-side so a client update is rarely urgent |

## Design system (all platforms)

- **Palette:** GitLab Foundation orange-red `#DF4329` (accent), warm near-black ink, white ground; light **and** dark, both AA-contrast (accent darkens to `#B7331C` for small text on light, lightens to `#F0674A` on dark).
- **Type:** Inter (display) + Poppins (body/UI) on web; the closest native equivalents on iOS/Android with the same scale.
- **Tokens** live in the shared package; each platform consumes them — no per-platform re-theming.

## Testing matrix

Web: Chrome, Safari, Firefox, Edge (desktop + mobile). PWA: install + offline on iOS
Safari and Android Chrome. Native (v2): iPhone SE → Pro Max, a small and a large Android.
Every platform runs the same end-to-end flow test: sign in → ask → verify a citation opens
the right passage → refusal on a restricted question.
