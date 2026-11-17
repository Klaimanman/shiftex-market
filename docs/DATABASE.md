# Database

Migrations: `supabase/migrations` (run in order). All org-scoped tables carry `org_id`. Times are `timestamptz`; operational dates are `date` in `Asia/Jerusalem`.

## Entities
| Table | Purpose | Key constraints |
|---|---|---|
| `organizations` | Tenant | — |
| `profiles` | Name, avatar, onboarding timestamp (visible to co-members) | PK = `auth.users.id` |
| `profile_private` | Email, phone (E.164 Israeli mobile) | own row + org admins only; unique phone |
| `organization_members` | Role & status per user | PK (org, user); **unique user** (one org per user in v1) |
| `organization_invites` | Hashed codes (SHA-256), hint, max uses, expiry, revocation | `use_count ≤ max_uses` |
| `invite_attempts` | Brute-force throttling | no client access |
| `organization_settings` | Coordinator email, limits, retention | admin update only |
| `shift_periods` | morning/afternoon/night/oncall labels & hours | unique (org, code); code immutable |
| `positions` | Positions + `requires_qualification` | unique (org, lower(name)) |
| `badges`, `badge_positions` | Badge → positions it qualifies for | |
| `member_badges` | Employee badges (`assigned_by` null = self-selected at onboarding) | FK to membership |
| `shift_listings` | Offer / seek / exchange | give-side & want-side checks; partial unique index against duplicates; `version` for optimistic concurrency |
| `listing_events` | Status history | append-only |
| `listing_interests` | Expressions of interest (optional exchange counter-offer) | unique (listing, user) |
| `saved_searches` | Filters JSON (≤2 KB), notify flag | ≤10 per user |
| `notifications` | In-app notifications | unique (user, dedupe_key) |
| `notification_preferences` | Per-category opt-out | |
| `contact_reveals` | Every phone disclosure | no client access |
| `admin_audit_logs` | Append-only admin actions | admins read; nobody writes directly |

`exchange_requests` from the original brief is modelled as `listing_interests.offered_listing_id` (same behaviour, one table fewer).

## Indexes
`shift_listings (org_id, status, shift_date, created_at)`, `(owner_id, status, created_at)`, GIN on `want_dates`, partial on `expires_at` for open listings; notifications `(user_id, created_at desc)`; audit `(org_id, created_at desc)`; plus all FK lookups used by policies.

## RLS summary
| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| listings | active members of org | owner (trigger validates) | owner (trigger validates transitions) | — |
| profiles | self, active co-members, admins | trigger | RPC | cascade |
| profile_private | self, org admins | trigger | RPC | cascade |
| members | self; active members see active; admins see all | RPC | RPC | — |
| periods/positions/badges | active members | admins | admins | admins |
| interests | own, listing owner, admins | RPC | RPC | — |
| notifications | own | trigger/RPC | own (`read_at` only) | own |
| audit | admins | definer functions | — | — |

Helper predicates (`is_active_member`, `is_org_admin`, `current_org_id`, `is_qualified`) are `STABLE SECURITY DEFINER` and read membership status live.

## Concurrency
- Status changes: `UPDATE … WHERE id = $1 AND version = $2` → zero rows = conflict shown to the user.
- `express_interest` / admin actions lock the target row (`FOR UPDATE`).
- Listing creation takes a per-user advisory lock so rate limits cannot be raced.
- Invite redemption increments `use_count` under row lock.

## Retention
Closed listings: `closed_retention_days` (default 90). Notifications: 60 days. Invite attempts: 7 days. Contact reveals: 90 days. Audit log: 2 years. Account deletion cascades all personal data.
