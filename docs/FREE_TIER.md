# Free-tier usage & limits

Verify current numbers on each provider's pricing page at setup time — free tiers change.

| Provider | Free allowance (at time of writing) | ShiftEX usage estimate (≈300 employees) |
|---|---|---|
| **Supabase** DB | 500 MB | < 50 MB/year (retention jobs keep it flat) |
| Supabase egress | 5 GB / month | ~0.5–1.5 GB (bounded queries, cached reference data) |
| Supabase Auth | 50,000 MAU | ≤ 300 |
| Supabase Realtime | 200 concurrent connections, 2M messages/month | 1 connection per *visible* tab; peak well under 200 |
| Supabase Storage | 1 GB | avatars ≈ 20 KB each → ~6 MB |
| Supabase Edge Functions | 500K invocations | 0 (phase 1 uses none) |
| Supabase projects | 2 active; **pause after 7 days idle** | keep-alive workflow every 3 days |
| **Cloudflare Pages** | Unlimited static requests & bandwidth, 500 builds/month | a few builds per change |
| **GitHub Actions** | Unlimited minutes for public repos | CI ~2 min per push |
| **Google OAuth** | Free; basic scopes need no verification | — |
| WhatsApp / email | `wa.me` and `mailto:` links — no API, no cost | — |

## Operational limitations
- **Pausing**: inactive Supabase Free projects pause; restore from the dashboard (data is kept).
- **No point-in-time recovery or downloadable backups** on Free → optional encrypted `backup.yml`.
- **Realtime cap**: above ~200 simultaneously open tabs, extra clients fall back to cached data + refetch on focus.
- **Scheduled GitHub workflows** stop after 60 days without repository activity.

## When costs could appear
| Trigger | Option |
|---|---|
| > 200 concurrent users with the app open | Supabase Pro (~$25/month) or reduce realtime to the board screen only |
| Need daily backups / PITR | Supabase Pro |
| Custom domain on the Google consent screen | Supabase custom domain add-on (paid) |
| Custom website domain | ~$10/year for a domain (Cloudflare Pages itself stays free) |
