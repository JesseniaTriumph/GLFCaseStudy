# Hosting the demo — one fluid URL, with or without real Google sign-in

`npm run demo` builds the web app and starts one server that serves **everything** on one
origin: the web UI, the JSON API, the sign-in flow, and (unless disabled) a demo persona
switch. Default: `http://localhost:8787`.

There is no separate "static site" and "login server" any more. The web page calls
`POST /api/ask` on the same origin; the server runs the permission filter, the rate
limiter, and the audit log on every request.

---

## Mode A — demo personas (zero setup)

Out of the box, `npm run demo` mounts `/auth/demo?persona=<key>` and the web app's
"Signed in as" dropdown uses it. Selecting a persona issues a **real Compass session** for
a fictional user — every downstream check (permission filter, rate limit, audit,
revocation) runs exactly as in production. Only the identity provider is stubbed.

This is the right mode for a screen-share or a recorded walk-through: you can flip between
"Program Officer" and "Communications & Marketing" live and show the permission boundary
move.

Turn it off for anything real: `COMPASS_NO_DEMO=1 npm run demo`.

---

## Mode B — real Google sign-in (~15 minutes, one-time)

Use this if the panel wants to see an actual login, or for a pilot with named people.
**Someone with access to a Google Cloud project does this once** — it cannot be done from
code because it creates a credential tied to a Google account.

### 1. Create an OAuth client

1. Google Cloud console → **APIs & Services → Credentials → Create credentials → OAuth
   client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI: `https://<your-demo-host>/auth/callback`
   (for local testing: `http://localhost:8787/auth/callback`).
4. Copy the **client ID** and **client secret**.

### 2. (Recommended) scope it to named people

Two ways, use both:

- **OAuth consent screen** → set to **Internal** if the demo host is in the same Google
  Workspace as the testers. Only that Workspace can sign in.
- **`COMPASS_ALLOWED_EMAILS`** → a comma-separated allowlist. A verified account whose
  email is not on the list is rejected *after* the signature and domain checks pass. This
  is the "send us the tester emails ahead of time" path.

### 3. Run it

```bash
export COMPASS_OAUTH_CLIENT_ID="…apps.googleusercontent.com"
export COMPASS_OAUTH_CLIENT_SECRET="…"
export COMPASS_OAUTH_REDIRECT_URI="https://<your-demo-host>/auth/callback"
export COMPASS_HD="yourworkspace.org"                 # hosted-domain check
export COMPASS_ALLOWED_EMAILS="a@x.org,b@x.org"       # optional
export COMPASS_SESSION_SECRET="$(openssl rand -base64 32)"
export COMPASS_GROUP_MAP='{"a@x.org":["programs"],"b@x.org":["comms"]}'
npm run demo
```

`COMPASS_GROUP_MAP` stands in for the production Google Groups lookup — it maps each
tester's email to the permission groups they should have, so you can demo "this person
sees programs-only, that person doesn't" with real accounts.

**In production**, set `GOOGLE_SA_KEY_JSON` (or `GOOGLE_SA_KEY_FILE`) + `GOOGLE_DIRECTORY_SUBJECT`
(an admin to impersonate) and the server uses the real read-only Admin SDK Directory lookup
instead — cached for `COMPASS_DIRECTORY_TTL_SEC` (default 300), fail-closed on any error.
Add `COMPASS_DIRECTORY_ACTIVE_CHECK=1` to also reject a suspended/archived account at
sign-in. The service account needs `admin.directory.group.readonly` (and
`admin.directory.user.readonly` for the active check), granted via domain-wide delegation.
The startup log prints which source is active (`group source: …`).

With `COMPASS_OAUTH_CLIENT_ID` set, the web app shows "Sign in with Google". You can leave
the demo personas on alongside it (handy — flip to a persona to show the boundary, then
sign in for real) or turn them off with `COMPASS_NO_DEMO=1`.

---

## Deploying it somewhere the panel can reach

The whole thing is one Node process. Any of:

- **A small always-on box** — Fly.io, Cloud Run, Render, a cheap VM. `npm ci && npm run
  web:build && node --import tsx scripts/serve.ts`, put HTTPS in front (the platform
  usually does), set the env vars above.
- **Locally + a tunnel** — `npm run demo`, then `cloudflared tunnel --url
  http://localhost:8787` or ngrok, for a time-boxed demo. Set the redirect URI to the
  tunnel URL.

`NODE_ENV=production` adds `Secure` to the session cookie and sends HSTS — set it whenever
the host is HTTPS.

### What's still not production

This makes the demo one clean URL. It is **not** the production deployment. Before real
data: least-privilege connector credentials, a KMS for secrets, Redis for the rate
limiter and revocation store, off-host audit storage, and a third-party penetration test.
See `docs/HARDEN_CHECKLIST.md` and `docs/ROADMAP.md`.
