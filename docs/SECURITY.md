# Security & privacy

## Threat model highlights
| Threat | Control |
|---|---|
| Outsider signs in with Google | No data readable without an **active** membership; joining needs an invite code **and** admin approval |
| Invite-code guessing | Codes are 50-bit random, looked up by SHA-256 hash; 5 failed attempts/hour per user; codes can expire, be capped and revoked. Plaintext is kept for admin display only (RLS: admins) — joining still requires admin approval |
| Employee escalates privileges | Membership, roles and badges are writable only via admin RPCs; no table grants for them |
| Self-assigned qualification | Badges may be chosen only while **pending** and are reviewed at approval; afterwards admin-only |
| Unqualified user takes a restricted shift | Enforced in `prepare_listing`, `express_interest` and `get_contact` (server), not just hidden in the UI |
| Editing someone else's listing | RLS `owner_id = auth.uid()` + trigger; immutable owner/type/org |
| Banned user keeps a valid JWT | Every policy/RPC checks membership status live; ban removes their listings |
| Phone-number scraping | Phones live in `profile_private`; disclosed only via `get_contact` for an open listing the caller may act on; 60/day; logged |
| Notification/listing spam | Per-user active & daily caps (admin-configurable), notification hourly cap, dedupe keys |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict CSP (`script-src 'self'`, no inline scripts) |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` |
| Malicious uploads | Images only, ≤300 KB at bucket level, client re-encodes to WebP, files under the owner's folder |
| Secret leakage | Only the publishable key ships to the browser; `.env*` ignored; no service-role key used anywhere in the app |

## Secrets
| Value | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cloudflare env vars, `.env.local` | No (public by design) |
| Google OAuth client secret | Supabase dashboard only | **Yes** |
| Supabase secret / service_role key | Not used | **Yes — never put in the repo or in VITE_ variables** |
| `SUPABASE_DB_URL` (backup workflow) | GitHub Actions secret | **Yes** |

## Privacy
- Data minimization: name, Google email, mobile number, optional avatar, badges, listings.
- No public directory: the site is `noindex`, and nothing is readable without approval.
- Users can delete their account (cascades all personal data). Retention jobs purge old data automatically.
- Israeli Privacy Protection Law (Amendment 13): publish the in-app privacy page (`/privacy`) and obtain the employer's agreement before rollout.
- Real position names and admin emails are kept out of the repository (`supabase/setup/*.local.sql` is git-ignored).

## Repository control
Public repository: anyone can read, only the owner (and invited collaborators) can push. Protect `main` (require PRs, block force-push) and require approval for workflows from forks. See DEPLOYMENT.he.md.

## Reporting
Report vulnerabilities privately to the repository owner (GitHub → Security → Report a vulnerability). Do not open public issues for security problems.
