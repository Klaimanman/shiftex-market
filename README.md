<div dir="ltr">

# ShiftEX Market

**Your shift. Your choice.**

A private, mobile-first marketplace where security employees offer, find and exchange work shifts — replacing chaotic group chats with a structured weekly board, deterministic matching, and one-tap WhatsApp / coordinator-email hand-offs.

Hebrew-first (RTL) · Light & dark themes · Installable PWA · Runs entirely on free tiers.

> ShiftEX is a **coordination tool**. It does not manage the official schedule and never approves transfers. Employees notify the scheduling coordinator themselves.

---

## Features

| Area | What it does |
|---|---|
| **Weekly board** | Real dates in `Asia/Jerusalem`, Sunday-start weeks, today highlighted, per-period density dots, filters (type, period, position, 12h option, "only what I can take"), oldest-first fair ordering |
| **Listings** | Offer · Seek (multiple dates/periods/positions) · Exchange (give X, want Y). Custom-named shifts, optional custom hours, notes. Lifecycle: active → in coordination → taken / cancelled / expired / removed |
| **Qualifications** | Badges (e.g. *Patrol*, *Terminal certified*, *Senior*) grant restricted positions. Unqualified users see restricted shifts as locked and are blocked server-side |
| **Matching** | Pure, unit-tested engine: exact / partial / none, respecting qualifications; exchange compares both directions |
| **Contact** | WhatsApp deep link with an editable, gender-neutral Hebrew message. Phone numbers are disclosed only through an audited, rate-limited RPC |
| **Coordinator email** | `mailto:` draft (recipient, subject, body pre-filled) after closing as taken. Never claims anything was sent |
| **Notifications** | In-app: new matches, interest in your listing, saved-search hits, account events. De-duplicated, capped, user-configurable |
| **Admin** | Approvals, suspend/ban (immediate), roles, badges, positions, shift hours, invite codes (hashed, shown once), moderation, append-only audit log |

## Stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS v4 · Radix Dialog · Lucide · TanStack Query ·
Supabase (Postgres + RLS, Auth with Google OAuth/PKCE, Realtime, Storage, pg_cron) · Cloudflare Pages · vite-plugin-pwa ·
Vitest + PGlite (real Postgres in WASM for authorization tests).

No paid APIs, no server to run, no AI at runtime.

## Architecture in one picture

```
Phone / desktop (PWA)
   │  TanStack Query cache  ·  1 Realtime channel (only while visible)
   ▼
Cloudflare Pages — static files, strict CSP (_headers)
   │  HTTPS · publishable key · user JWT
   ▼
Supabase
   ├─ Auth: Google OAuth (PKCE)
   ├─ Postgres: RLS on every table; privileged writes via SECURITY DEFINER RPCs
   │            (membership, invites, contact, admin) — all audited
   ├─ Triggers: listing validation, qualification checks, rate limits, matching notifications
   ├─ pg_cron: expiry every 10 min, daily retention
   └─ Storage: avatars (≤300 KB, images only)
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/FREE_TIER.md](docs/FREE_TIER.md) · [docs/TESTING.md](docs/TESTING.md) · [docs/PRODUCT.md](docs/PRODUCT.md)

## Getting started

```bash
npm install
npm run dev:demo      # UI with fictional data, no backend needed
npm test              # unit + database authorization tests (no Docker needed)
npm run build
```

To run against a real backend, copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key.

**Deploying to production (free):** follow [docs/DEPLOYMENT.he.md](docs/DEPLOYMENT.he.md) — a step-by-step guide in Hebrew covering GitHub, Supabase, Google OAuth and Cloudflare Pages.

## Project structure

```
src/
  domain/        pure logic — dates (Asia/Jerusalem), matching, filters, messages, validation
  data/          Supabase queries & mutations (TanStack Query hooks), realtime
  components/    design-system primitives (ui/) and app components
  pages/         screens; pages/admin is a separate lazy-loaded chunk
  dev/demo.ts    dev-only fictional backend (excluded from production builds)
supabase/
  migrations/    schema, functions/triggers, RLS & grants, platform (cron/realtime/storage)
  setup/         one-time organization bootstrap (real values live in *.local.sql, git-ignored)
tests/
  unit/          dates, DST, matching, messages, validation
  db/            RLS / RPC authorization scenarios against the real migrations
docs/            product, architecture, database, security, free tier, testing, deployment
```

## Data & privacy

The repository contains **no real employee data, organization secrets or credentials**. Real position names and the admin email are entered via the git-ignored `supabase/setup/setup.local.sql` or the admin UI. See [docs/SECURITY.md](docs/SECURITY.md).

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## License

All rights reserved — see [LICENSE](LICENSE). The source is published for viewing; reuse requires permission.

</div>
