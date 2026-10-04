# ADR-003: Hash Routing

## Status
Accepted

## Context
React Router v7 supports three modes: framework mode (SSR), data mode (client-side with loaders/actions), and declarative mode (simple client-side). The app runs as a Capacitor shell on iOS and Android.

## Decision
Use `createHashRouter` (data mode) exclusively. Never use `createBrowserRouter` or framework mode.

## Why
1. **Capacitor filesystem** — Native apps load from `capacitor://` or `file://` URLs. HTML5 History API (`pushState`) does not work with these protocols. Hash routing (`/#/path`) works everywhere.
2. **Data mode advantages** — Loaders and actions provide structured data fetching with pending/error states. Declarative mode works but lacks these features.
3. **No server required** — Framework mode requires a server for SSR. Capacitor apps have no server. The SPA is a static bundle served from the device filesystem.
4. **Deployment simplicity** — Hash routing requires no server-side catch-all rewrite. Works on any static hosting (Vercel, S3, Capacitor).

## Consequences
- URLs contain `#` (e.g., `https://app.tracks.com/#/dashboard`) — minor aesthetic trade-off
- No SSR — acceptable for apps behind authentication (no SEO needed for app routes)
- Deep linking on mobile works via Capacitor's App plugin + hash parsing
