# Product specification (condensed)

## Roles
| Role | Can |
|---|---|
| **Employee** (active) | Browse the board, create/edit/close own listings, express interest, contact via WhatsApp, prepare coordinator email, saved searches, notifications, edit own profile |
| **Administrator** | Everything above + approve/reject/suspend/ban members, assign roles and badges, configure positions, badges, shift hours, coordinator email and limits, manage invite codes, remove listings, read the audit log |
| Pending / suspended / banned / rejected | Only their own status screen. No marketplace data is readable (enforced by RLS) |

## Access flow
Google sign-in → profile (name + Israeli mobile) → invite code → choose own badges → **pending** → admin reviews badges & approves → **active**.
Google sign-in alone never grants access. Badges self-selected at onboarding are reviewed at approval; afterwards only admins change them.

## Shifts
- Periods: **בוקר, צהריים, לילה, כונן** (on-call is a shift of its own). Labels and hours are admin-configured; hours are never hardcoded.
- Any shift may carry a **12-hour option** ("אופציה ל־12 שעות") flag; it is never assumed activated.
- A listing can be a **non-standard shift** with its own name (e.g. "משמרת אירוע") and optional custom hours.
- A night shift belongs to the date it starts.

## Positions & qualifications
Positions are database records with a `requires_qualification` flag. A badge grants a set of positions.
A user is qualified for a position if it is unrestricted or one of their active badges grants it.
Initial mapping (editable): Patrol → סיור 50/51 · Terminal certified → מסוף · Senior → סיור 53, אולם נוסעים · קשמ״ז open.

## Listings
| Type | Give side | Want side |
|---|---|---|
| Offer (מסירה) | date, period, position, option, custom name/hours | — |
| Seek (חיפוש) | — | 1–14 dates, periods (empty = any), positions (empty = any qualified) |
| Exchange (החלפה) | as offer | as seek |

Rules: dates from today to +60 days · offer/exchange creator must be qualified for the position · no duplicate open listing for the same shift · rate limits (default 15 active, 20/day) · expires when the shift starts (seek: end of last wanted date) · owners close listings; contacting never closes them · no hard deletes by users.

Lifecycle: `active ⇄ in_coordination → closed_taken | closed_cancelled | expired | removed_by_admin`.

## Matching
Exact = same date, period (or any), position, option acceptable. Partial = same date and *either* period *or* position matches. Exchanges compare both directions (one direction only ⇒ partial). Offer/seek ↔ exchange is at most partial. Unqualified pairs never match. Ordering: exact first, then oldest listing first.

## Notifications (phase 1 — in-app)
match · seeker_found · saved_search · interest · interest_update · listing_closed · listing_removed · account_approved · account_status · member_pending.
De-duplicated by key, capped at 30 marketplace notifications/hour/user, per-category opt-out. Phase 2 (optional): Web Push via VAPID + Supabase Edge Function.

## Edge cases handled
Month/year boundaries · DST (computed in `Asia/Jerusalem`) · admin changes period hours (open listings re-timed) · listing closed while viewed (realtime refresh + "no longer available") · concurrent edits (optimistic `version`) · double submit (client-generated id) · ban takes effect on next request · last admin protected · banned users cannot rejoin · invite brute force (5 failures/hour) · database unavailable (retry + clear error states) · Google auth cancelled/failed (explicit message) · no matches (guided empty states).

## Definition of Done — status
| Item | Status |
|---|---|
| Google auth, org membership, approval | Implemented; server logic covered by DB tests. Live Google flow must be verified after deployment |
| Create/manage listings, visibility, closure | Implemented + DB tests |
| Calendar dates, DST, filters | Implemented + unit tests |
| Qualification restrictions | Implemented + DB tests |
| WhatsApp links, email drafts | Implemented + unit tests |
| Matching | Implemented + unit tests |
| Light/Dark, responsive | Implemented; reviewed visually in demo mode |
| RLS, admin capabilities | Implemented + DB tests |
| Free deployment | Documented in DEPLOYMENT.he.md |
