# Architecture

## Principles
1. **The database is the security boundary.** The client is untrusted; every rule (membership, qualification, ownership, rate limits, transitions) is enforced in Postgres.
2. **Static front-end, serverless back-end.** No server process to pay for or patch.
3. **Pure domain logic.** Dates, matching, filtering and message composition live in `src/domain` with no React or network code, and are unit-tested.
4. **Cheap by design.** One Realtime channel per open tab (closed when hidden), cached queries, bounded result sets, no polling.

## Front-end
| Concern | Choice |
|---|---|
| Routing | React Router; access gate in `App.tsx` decides between Welcome / Onboarding / Pending / Restricted / App from `my_context()` |
| Data | TanStack Query; keys `ctx`, `periods`, `positions`, `badges`, `listings/*`, `interests/*`, `notifications/*`, `admin/*` |
| Realtime | `useRealtimeSync` subscribes to `shift_listings` (org filter) and own `notifications` inserts; events only invalidate queries |
| Forms | Controlled state + Zod (`domain/validation.ts`); server re-validates |
| UI | Tailwind v4 tokens (`styles/index.css`), hand-built primitives in `components/ui`, Radix Dialog for accessible sheets |
| Theme | `public/theme-init.js` sets `data-theme` before first paint; `ThemeProvider` persists light/dark/system |
| RTL | `<html dir="rtl">`, logical CSS properties, `<bdi dir="ltr">` for phones/emails/times, LRI/PDI isolates in formatted ranges |
| PWA | vite-plugin-pwa (Workbox), precaches shell + Hebrew/Latin fonts only; API traffic is never cached |
| Code splitting | `react`, `data` vendor chunks; admin area lazy-loaded |

## Back-end (Supabase)
- **Tables & RLS** — see [DATABASE.md](DATABASE.md).
- **Triggers** on `shift_listings` normalize and validate every insert/update (`prepare_listing`), enforce owner/admin transitions, write `listing_events`, and fan out match notifications.
- **RPCs** (`SECURITY DEFINER`, `search_path=''`): `my_context`, `save_my_profile`, `validate_invite`, `join_organization`, `express_interest`, `set_interest_status`, `get_contact`, `get_org_settings`, `admin_*`, `delete_my_account`, `health`.
- **pg_cron**: `expire_listings()` every 10 minutes; `run_retention()` daily. Queries also filter `expires_at > now()` so correctness never depends on cron.
- **Storage**: public `avatars` bucket, owner-folder policies, 300 KB / image MIME limits; client resizes to 256 px WebP.

## Authentication flow
1. `signInWithOAuth({ provider: 'google' })` with PKCE → Google → Supabase `/auth/v1/callback` → app `/auth/callback?code=…`.
2. supabase-js exchanges the code; `on_auth_user_created` trigger creates `profiles` + `profile_private`.
3. `my_context()` drives the gate. Membership status is read **live** from the database on every request — a ban does not wait for JWT expiry.

## Deployment
GitHub (source, CI) → Cloudflare Pages (build `npm run build`, serve `dist`, `_headers` CSP, `_redirects` SPA fallback) → Supabase (migrations run once via SQL editor or `supabase db push`).

## Known limitations
- Google's consent screen shows the `*.supabase.co` domain (custom auth domains are a paid Supabase feature).
- iOS standalone PWAs may open Google sign-in in a Safari sheet; sign-in still completes. If not, sign in once in Safari, then reopen the installed app.
- Web Push (phase 2) is not implemented yet; notifications are in-app.
- Rollup's native binary is replaced with `@rollup/wasm-node` (npm override) so builds also work on Windows machines with Smart App Control.
