# Contributing

This repository is maintained by its owner; changes land through pull requests into `main`.

- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Before a PR**: `npm run typecheck && npm test && npm run build`.
- **Database changes**: add a new timestamped file in `supabase/migrations` — never edit an applied migration. Add a `tests/db` scenario for any authorization change.
- **UI**: Hebrew copy is gender-neutral; use logical CSS properties (`ps-`, `me-`, `start-`), wrap LTR fragments in `<bdi dir="ltr">`, and check both themes.
- **Never commit** `.env*` (except `.env.example` / `.env.demo`), real employee data, or `*.local.sql`.
