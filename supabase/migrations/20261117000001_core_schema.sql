-- ShiftEX Market — core schema
-- Conventions: every org-scoped table carries org_id; timestamps are timestamptz;
-- operational (calendar) dates are `date` interpreted in Asia/Jerusalem.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('employee', 'admin');
create type public.member_status as enum ('pending', 'active', 'suspended', 'banned', 'rejected');
create type public.period_code as enum ('morning', 'afternoon', 'night', 'oncall');
create type public.listing_type as enum ('offer', 'seek', 'exchange');
create type public.listing_status as enum (
  'active', 'in_coordination', 'closed_taken', 'closed_cancelled', 'expired', 'removed_by_admin'
);
create type public.interest_status as enum ('open', 'withdrawn', 'declined', 'accepted');

-- ---------------------------------------------------------------------------
-- Organizations & people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  created_at  timestamptz not null default now()
);

-- Public-within-organization profile data (no contact details here).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '' check (char_length(full_name) <= 80),
  avatar_url    text check (avatar_url is null or (char_length(avatar_url) <= 600 and avatar_url like 'https://%')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Contact details are isolated: only the user and their org admins can read them.
-- Other members obtain a phone number exclusively through get_contact() (audited, rate-limited).
create table public.profile_private (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  email       text not null check (char_length(email) <= 254),
  phone_e164  text check (phone_e164 is null or phone_e164 ~ '^\+9725[0-9]{8}$'),
  updated_at  timestamptz not null default now()
);
create unique index profile_private_phone_uq on public.profile_private (phone_e164) where phone_e164 is not null;

create table public.organization_members (
  org_id         uuid not null references public.organizations (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  role           public.member_role not null default 'employee',
  status         public.member_status not null default 'pending',
  invite_id      uuid,
  status_reason  text check (status_reason is null or char_length(status_reason) <= 300),
  approved_by    uuid references public.profiles (id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (org_id, user_id)
);
-- v1: a person belongs to exactly one organization.
create unique index organization_members_user_uq on public.organization_members (user_id);
create index organization_members_org_status_idx on public.organization_members (org_id, status);

create table public.organization_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code_hash   text not null unique,
  code_hint   text not null check (char_length(code_hint) <= 8),
  label       text check (label is null or char_length(label) <= 60),
  max_uses    int not null default 50 check (max_uses between 1 and 1000),
  use_count   int not null default 0 check (use_count >= 0),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (use_count <= max_uses)
);
create index organization_invites_org_idx on public.organization_invites (org_id, created_at desc);

-- Brute-force protection for invite codes.
create table public.invite_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  success       boolean not null,
  attempted_at  timestamptz not null default now()
);
create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at desc);

create table public.organization_settings (
  org_id                    uuid primary key references public.organizations (id) on delete cascade,
  coordinator_email         text check (coordinator_email is null or coordinator_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  max_active_listings       int not null default 15 check (max_active_listings between 1 and 100),
  max_new_listings_per_day  int not null default 20 check (max_new_listings_per_day between 1 and 200),
  closed_retention_days     int not null default 90 check (closed_retention_days between 7 and 730),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Operational reference data (admin-managed, never hardcoded in the client)
-- ---------------------------------------------------------------------------
create table public.shift_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        public.period_code not null,
  label       text not null check (char_length(label) between 1 and 30),
  start_time  time,      -- null until the administrator configures it
  end_time    time,      -- end < start means the shift ends the next day
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);

create table public.positions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizations (id) on delete cascade,
  name                    text not null check (char_length(btrim(name)) between 1 and 40),
  requires_qualification  boolean not null default false,
  is_active               boolean not null default true,
  sort_order              smallint not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index positions_org_name_uq on public.positions (org_id, lower(btrim(name)));

-- Badges ("תגים") such as "סיור", "מוסמך מסוף", "מאבטח בכיר".
-- A badge grants qualification for a set of positions.
create table public.badges (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  description  text check (description is null or char_length(description) <= 200),
  is_active    boolean not null default true,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index badges_org_name_uq on public.badges (org_id, lower(btrim(name)));

create table public.badge_positions (
  org_id       uuid not null references public.organizations (id) on delete cascade,
  badge_id     uuid not null references public.badges (id) on delete cascade,
  position_id  uuid not null references public.positions (id) on delete cascade,
  primary key (badge_id, position_id)
);
create index badge_positions_position_idx on public.badge_positions (position_id);

-- Employee qualifications are expressed through badges.
-- assigned_by is null when the employee selected the badge during onboarding (reviewed at approval).
create table public.member_badges (
  org_id       uuid not null,
  user_id      uuid not null,
  badge_id     uuid not null references public.badges (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (user_id, badge_id),
  foreign key (org_id, user_id) references public.organization_members (org_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------
create table public.shift_listings (
  id                 uuid primary key default gen_random_uuid(),  -- client may supply (idempotency)
  org_id             uuid not null references public.organizations (id) on delete cascade,
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  type               public.listing_type not null,
  status             public.listing_status not null default 'active',

  -- The concrete shift being given (offer / exchange). Null for seek.
  shift_date         date,
  period_id          uuid references public.shift_periods (id),
  position_id        uuid references public.positions (id),
  has_option         boolean not null default false,   -- "אופציה ל־12 שעות"
  custom_title       text check (custom_title is null or char_length(custom_title) between 2 and 40),
  custom_start       time,
  custom_end         time,

  -- What is wanted (seek / exchange-in-return). Empty period list = any period.
  -- want_position_ids is always filled server-side with positions the owner is qualified for.
  want_dates         date[] not null default '{}',
  want_period_ids    uuid[] not null default '{}',
  want_position_ids  uuid[] not null default '{}',
  want_option_ok     boolean not null default true,

  note               text check (note is null or char_length(note) <= 280),
  starts_at          timestamptz not null,
  expires_at         timestamptz not null,
  taken_by           uuid references public.profiles (id) on delete set null,
  removed_reason     text check (removed_reason is null or char_length(removed_reason) <= 300),
  version            int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  closed_at          timestamptz,

  constraint listing_give_side check (
    type = 'seek' or (shift_date is not null and period_id is not null and position_id is not null)
  ),
  constraint listing_want_side check (
    (type = 'offer' and cardinality(want_dates) = 0)
    or (type <> 'offer' and cardinality(want_dates) between 1 and 14)
  ),
  constraint listing_custom_times check ((custom_start is null) = (custom_end is null))
);
create index shift_listings_org_open_idx on public.shift_listings (org_id, status, shift_date, created_at);
create index shift_listings_owner_idx on public.shift_listings (owner_id, status, created_at desc);
create index shift_listings_want_dates_idx on public.shift_listings using gin (want_dates);
create index shift_listings_expires_idx on public.shift_listings (expires_at) where status in ('active', 'in_coordination');
-- Prevent accidental duplicate open listings for the same concrete shift.
create unique index shift_listings_no_dup_uq on public.shift_listings (owner_id, type, shift_date, period_id, position_id)
  where status in ('active', 'in_coordination') and type <> 'seek';

-- Minimal lifecycle history for auditing.
create table public.listing_events (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  listing_id   uuid not null references public.shift_listings (id) on delete cascade,
  actor_id     uuid,
  from_status  public.listing_status,
  to_status    public.listing_status not null,
  created_at   timestamptz not null default now()
);
create index listing_events_listing_idx on public.listing_events (listing_id, created_at);

-- Expressions of interest. offered_listing_id turns it into an exchange proposal.
create table public.listing_interests (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  listing_id          uuid not null references public.shift_listings (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  offered_listing_id  uuid references public.shift_listings (id) on delete set null,
  note                text check (note is null or char_length(note) <= 280),
  status              public.interest_status not null default 'open',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (listing_id, user_id)
);
create index listing_interests_user_idx on public.listing_interests (user_id, created_at desc);

create table public.saved_searches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  filters     jsonb not null default '{}'::jsonb
              check (jsonb_typeof(filters) = 'object' and octet_length(filters::text) <= 2000),
  notify      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index saved_searches_org_idx on public.saved_searches (org_id) where notify;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in (
                'match', 'seeker_found', 'saved_search', 'interest', 'interest_update',
                'listing_closed', 'listing_removed', 'account_approved', 'account_status', 'member_pending')),
  listing_id  uuid references public.shift_listings (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  dedupe_key  text not null check (char_length(dedupe_key) <= 200),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  matches         boolean not null default true,
  interests       boolean not null default true,
  saved_searches  boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- Every phone-number disclosure is recorded (rate limiting + accountability).
create table public.contact_reveals (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  listing_id      uuid references public.shift_listings (id) on delete set null,
  target_user_id  uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index contact_reveals_user_idx on public.contact_reveals (user_id, created_at desc);

-- Append-only administrative audit log.
create table public.admin_audit_logs (
  id           bigint generated always as identity primary key,
  org_id       uuid references public.organizations (id) on delete cascade,
  actor_id     uuid,
  action       text not null,
  target_type  text not null,
  target_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index admin_audit_logs_org_idx on public.admin_audit_logs (org_id, created_at desc);
