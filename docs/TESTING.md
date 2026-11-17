# Testing

```bash
npm test            # everything (≈3 s)
npm run test:unit   # domain logic
npm run test:db     # database authorization
npm run typecheck
npm run build
npm run dev:demo    # manual UI review with fictional data
```

## Database authorization tests (`tests/db`)
The real migrations run inside **PGlite** (Postgres compiled to WASM) with a minimal stub of Supabase's `auth` schema and roles. Tests switch to the `authenticated` role with a JWT `sub`, so RLS, grants, triggers and RPCs are exercised exactly as in production — no Docker required.

Scenarios covered (38):
- bootstrap runs once; clients cannot call it
- invalid phone, wrong invite codes, brute-force lockout, pending users see nothing
- employees cannot approve themselves, grant badges, or edit membership
- self-selected badges become qualifications only after approval
- unqualified employee cannot offer / express interest / get contact for a restricted (53) shift — but can see it locked
- server overrides client-sent owner/status; past dates rejected; duplicates rejected
- a user cannot modify, impersonate admin removal on, or delete another user's listing
- two users acting on the same version → exactly one wins
- closed listings cannot be reopened; taken-by must be an active colleague
- expiry job closes started shifts; night-shift start computed in Asia/Jerusalem
- phone numbers unreadable except via `get_contact` (logged); invite codes stored hashed
- ban is immediate, removes listings, blocks rejoining; admin cannot ban self; last admin protected
- employees cannot change config; coordinator email readable by members
- match notifications sent once, never to unqualified seekers; users can only mark notifications read

## Unit tests (`tests/unit`)
Week math (Sunday start), month & year boundaries, leap years, DST start/end (Israel), today-in-Israel near midnight, matching matrix (exact/partial/none, qualifications, exchanges, ordering), WhatsApp/mailto encoding, phone normalization, grouping/filters, form validation.

## Not automated (manual checklist after deployment)
- Real Google sign-in (success, cancel, wrong redirect)
- Realtime update across two devices
- PWA install on iOS and Android; iOS standalone sign-in
- WhatsApp deep link opening on a phone; `mailto:` opening the mail app
- Screen reader pass (VoiceOver / TalkBack) on the board, listing details and forms
