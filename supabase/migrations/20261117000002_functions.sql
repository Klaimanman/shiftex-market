-- ShiftEX Market — server-side logic.
-- All SECURITY DEFINER functions pin search_path = '' and fully qualify every object.
-- Error convention: RAISE with a stable machine key as MESSAGE (mapped to Hebrew in the client).

-- ===========================================================================
-- Generic helpers
-- ===========================================================================
create or replace function public.today_il() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jerusalem')::date
$$;

-- Instant at which a shift on date d starting at local time t begins (DST-safe).
-- Unknown start time -> end of that day (keeps the listing visible for the whole day).
create or replace function public.shift_start_ts(d date, t time) returns timestamptz
language sql immutable set search_path = '' as $$
  select case
    when t is null then ((d + 1)::timestamp) at time zone 'Asia/Jerusalem'
    else (d + t) at time zone 'Asia/Jerusalem'
  end
$$;

create or replace function public.is_system_context() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is null or coalesce(current_setting('shiftex.system', true), '') = 'on'
$$;

create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.org_id from public.organization_members m
  where m.user_id = auth.uid() and m.status = 'active'
$$;

create or replace function public.is_active_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin'
  )
$$;

create or replace function public.is_member_active(p_user uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
  )
$$;

-- A user is qualified for a position when it is unrestricted, or one of their
-- active badges grants it.
create or replace function public.is_qualified(p_user uuid, p_position uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.positions p
    where p.id = p_position
      and (
        not p.requires_qualification
        or exists (
          select 1
          from public.member_badges mb
          join public.badges b on b.id = mb.badge_id and b.is_active
          join public.badge_positions bp on bp.badge_id = mb.badge_id
          where mb.user_id = p_user and bp.position_id = p_position
        )
      )
  )
$$;

create or replace function public.normalize_il_mobile(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d like '9725%' and length(d) = 12 then return '+' || d; end if;
  if d like '05%' and length(d) = 10 then return '+972' || substr(d, 2); end if;
  if d like '5%' and length(d) = 9 then return '+972' || d; end if;
  return null;
end $$;

create or replace function public.hash_invite_code(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

create or replace function public.generate_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b1 bytea := uuid_send(gen_random_uuid());
  b2 bytea := uuid_send(gen_random_uuid());
  r text := '';
  i int;
begin
  -- bytes 0..4 of a v4 UUID are fully random
  for i in 0..4 loop r := r || substr(alphabet, (get_byte(b1, i) % 32) + 1, 1); end loop;
  for i in 0..4 loop r := r || substr(alphabet, (get_byte(b2, i) % 32) + 1, 1); end loop;
  return substr(r, 1, 5) || '-' || substr(r, 6, 5);
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.organization_members for each row execute function public.touch_updated_at();
create trigger positions_touch before update on public.positions for each row execute function public.touch_updated_at();
create trigger badges_touch before update on public.badges for each row execute function public.touch_updated_at();
create trigger periods_touch before update on public.shift_periods for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.organization_settings for each row execute function public.touch_updated_at();
create trigger saved_searches_touch before update on public.saved_searches for each row execute function public.touch_updated_at();
create trigger interests_touch before update on public.listing_interests for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Audit
-- ===========================================================================
create or replace function public.write_audit(p_org uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_logs (org_id, actor_id, action, target_type, target_id, details)
  values (p_org, auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Generic audit trigger for admin-managed configuration tables.
create or replace function public.tg_audit_config() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  perform public.write_audit(
    (v_row ->> 'org_id')::uuid,
    lower(tg_op) || ':' || tg_table_name,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'badge_id', v_row ->> 'org_id'),
    jsonb_build_object('old', v_old, 'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end)
  );
  return null;
end $$;

create trigger audit_positions after insert or update or delete on public.positions for each row execute function public.tg_audit_config();
create trigger audit_badges after insert or update or delete on public.badges for each row execute function public.tg_audit_config();
create trigger audit_badge_positions after insert or delete on public.badge_positions for each row execute function public.tg_audit_config();
create trigger audit_periods after update on public.shift_periods for each row execute function public.tg_audit_config();
create trigger audit_settings after update on public.organization_settings for each row execute function public.tg_audit_config();

-- badge_positions.org_id must match the badge & position organization.
create or replace function public.tg_badge_positions_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select b.org_id into new.org_id from public.badges b where b.id = new.badge_id;
  if not exists (select 1 from public.positions p where p.id = new.position_id and p.org_id = new.org_id) then
    raise exception using message = 'invalid_position';
  end if;
  return new;
end $$;
create trigger badge_positions_check before insert on public.badge_positions for each row execute function public.tg_badge_positions_check();

-- Organization settings: record who changed them.
create or replace function public.tg_settings_by() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_by := auth.uid(); new.org_id := old.org_id; return new; end $$;
create trigger settings_by before update on public.organization_settings for each row execute function public.tg_settings_by();

-- Shift periods: code and org are immutable.
create or replace function public.tg_periods_guard() returns trigger
language plpgsql set search_path = '' as $$
begin new.code := old.code; new.org_id := old.org_id; return new; end $$;
create trigger periods_guard before update on public.shift_periods for each row execute function public.tg_periods_guard();

-- ===========================================================================
-- Profiles
-- ===========================================================================
create or replace function public.ensure_profile(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  select id, email, raw_user_meta_data as meta into u from auth.users where id = p_user;
  if not found then return; end if;
  insert into public.profiles (id, full_name, avatar_url)
  values (
    u.id,
    left(btrim(coalesce(u.meta ->> 'full_name', u.meta ->> 'name', '')), 80),
    case when coalesce(u.meta ->> 'avatar_url', u.meta ->> 'picture', '') like 'https://%'
         then left(coalesce(u.meta ->> 'avatar_url', u.meta ->> 'picture'), 600) end
  )
  on conflict (id) do nothing;
  insert into public.profile_private (user_id, email)
  values (u.id, lower(coalesce(u.email, '')))
  on conflict (user_id) do update set email = excluded.email, updated_at = now();
end $$;

create or replace function public.tg_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.ensure_profile(new.id); return new; end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.tg_handle_new_user();

-- Returns everything the client needs to route the user (gate) in one call.
create or replace function public.my_context() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  perform public.ensure_profile(v_uid);

  select jsonb_build_object(
    'user_id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
    'onboarded', p.onboarded_at is not null, 'email', pp.email, 'phone', pp.phone_e164)
  into v
  from public.profiles p left join public.profile_private pp on pp.user_id = p.id
  where p.id = v_uid;

  if v is null then raise exception using message = 'not_authenticated'; end if;

  v := v || jsonb_build_object('membership', (
    select jsonb_build_object(
      'org_id', m.org_id, 'org_name', o.name, 'role', m.role, 'status', m.status,
      'status_reason', m.status_reason, 'created_at', m.created_at)
    from public.organization_members m join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid));

  v := v || jsonb_build_object(
    'badge_ids', coalesce((select jsonb_agg(mb.badge_id) from public.member_badges mb where mb.user_id = v_uid), '[]'::jsonb),
    'badge_names', coalesce((select jsonb_agg(b.name order by b.sort_order) from public.member_badges mb
                              join public.badges b on b.id = mb.badge_id where mb.user_id = v_uid), '[]'::jsonb),
    'qualified_position_ids', coalesce((
      select jsonb_agg(p.id order by p.sort_order)
      from public.positions p
      join public.organization_members m on m.org_id = p.org_id and m.user_id = v_uid
      where public.is_qualified(v_uid, p.id)), '[]'::jsonb));
  return v;
end $$;

-- Create or update own name + phone. Also completes onboarding step 1.
create or replace function public.save_my_profile(p_full_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := public.normalize_il_mobile(p_phone);
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_name !~ '[[:alpha:]]' then
    raise exception using message = 'invalid_name';
  end if;
  if v_phone is null then raise exception using message = 'invalid_phone'; end if;
  if exists (select 1 from public.profile_private where phone_e164 = v_phone and user_id <> v_uid) then
    raise exception using message = 'phone_taken';
  end if;
  perform public.ensure_profile(v_uid);
  update public.profiles set full_name = v_name, onboarded_at = coalesce(onboarded_at, now()) where id = v_uid;
  update public.profile_private set phone_e164 = v_phone, updated_at = now() where user_id = v_uid;
  return public.my_context();
end $$;

-- p_url: a public URL inside the avatars bucket under the caller's folder, or null to clear.
create or replace function public.set_my_avatar(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  if p_url is not null and (
       char_length(p_url) > 600
       or p_url not like 'https://%'
       or position(('/storage/v1/object/public/avatars/' || v_uid::text || '/') in p_url) = 0) then
    raise exception using message = 'invalid_avatar';
  end if;
  update public.profiles set avatar_url = p_url where id = v_uid;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); m public.organization_members;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  select * into m from public.organization_members where user_id = v_uid;
  if found and m.role = 'admin' and m.status = 'active' and not exists (
    select 1 from public.organization_members x
    where x.org_id = m.org_id and x.role = 'admin' and x.status = 'active' and x.user_id <> v_uid) then
    raise exception using message = 'last_admin';
  end if;
  if found then
    perform public.write_audit(m.org_id, 'self_delete', 'member', v_uid::text, '{}'::jsonb);
  end if;
  delete from auth.users where id = v_uid;  -- cascades to profiles, listings, interests, notifications
end $$;

-- ===========================================================================
-- Invitations & membership
-- ===========================================================================
create or replace function public.recent_invite_failures(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.invite_attempts
  where user_id = p_user and not success and attempted_at > now() - interval '1 hour'
$$;

-- Step 2 of onboarding: check a code and reveal the org's badge list. Does not consume the code.
-- Returns {ok:false,error} instead of raising so the failed attempt is recorded.
create or replace function public.validate_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); inv public.organization_invites;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  if public.recent_invite_failures(v_uid) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;
  select * into inv from public.organization_invites
  where code_hash = public.hash_invite_code(p_code)
    and revoked_at is null and (expires_at is null or expires_at > now()) and use_count < max_uses;
  if not found then
    insert into public.invite_attempts (user_id, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  return jsonb_build_object(
    'ok', true,
    'org_name', (select name from public.organizations where id = inv.org_id),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description) order by b.sort_order, b.name)
      from public.badges b where b.org_id = inv.org_id and b.is_active), '[]'::jsonb));
end $$;

create or replace function public.join_organization(p_code text, p_badge_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  inv public.organization_invites;
  m public.organization_members;
  a record;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and onboarded_at is not null) then
    raise exception using message = 'profile_incomplete';
  end if;
  select * into m from public.organization_members where user_id = v_uid;
  if found then
    if m.status = 'banned' then raise exception using message = 'banned'; end if;
    if m.status <> 'rejected' then raise exception using message = 'already_member'; end if;
  end if;
  if public.recent_invite_failures(v_uid) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into inv from public.organization_invites
  where code_hash = public.hash_invite_code(p_code)
    and revoked_at is null and (expires_at is null or expires_at > now()) and use_count < max_uses
  for update;
  if not found then
    insert into public.invite_attempts (user_id, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  update public.organization_invites set use_count = use_count + 1 where id = inv.id;
  insert into public.invite_attempts (user_id, success) values (v_uid, true);
  delete from public.organization_members where user_id = v_uid and status = 'rejected';
  insert into public.organization_members (org_id, user_id, role, status, invite_id)
  values (inv.org_id, v_uid, 'employee', 'pending', inv.id);

  -- Self-selected badges are only accepted here (pending state) and reviewed by an admin at approval.
  insert into public.member_badges (org_id, user_id, badge_id, assigned_by)
  select inv.org_id, v_uid, b.id, null
  from public.badges b
  where b.org_id = inv.org_id and b.is_active and b.id = any (coalesce(p_badge_ids, '{}'::uuid[]))
  limit 5;

  for a in select user_id from public.organization_members
           where org_id = inv.org_id and role = 'admin' and status = 'active' loop
    perform public.push_notification(a.user_id, inv.org_id, 'member_pending', null, v_uid,
      jsonb_build_object('user_id', v_uid), 'pending:' || v_uid::text);
  end loop;

  return jsonb_build_object('ok', true);
end $$;

-- ===========================================================================
-- Notifications
-- ===========================================================================
create or replace function public.push_notification(
  p_user uuid, p_org uuid, p_kind text, p_listing uuid, p_actor uuid, p_payload jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_pref public.notification_preferences; v_recent int;
begin
  if p_user is null or p_user = p_actor then return; end if;
  select * into v_pref from public.notification_preferences where user_id = p_user;
  if found then
    if p_kind in ('match', 'seeker_found') and not v_pref.matches then return; end if;
    if p_kind = 'saved_search' and not v_pref.saved_searches then return; end if;
    if p_kind in ('interest', 'interest_update', 'listing_closed') and not v_pref.interests then return; end if;
  end if;
  -- Anti-spam cap for marketplace notifications (account messages always delivered).
  if p_kind not in ('account_approved', 'account_status', 'listing_removed', 'member_pending') then
    select count(*) into v_recent from public.notifications
    where user_id = p_user and created_at > now() - interval '1 hour';
    if v_recent >= 30 then return; end if;
  end if;
  insert into public.notifications (org_id, user_id, kind, listing_id, actor_id, payload, dedupe_key)
  values (p_org, p_user, p_kind, p_listing, p_actor, coalesce(p_payload, '{}'::jsonb), left(p_dedupe, 200))
  on conflict (user_id, dedupe_key) do nothing;
end $$;

create or replace function public.saved_search_matches(f jsonb, l public.shift_listings) returns boolean
language sql immutable set search_path = '' as $$
  select
        (coalesce(jsonb_array_length(f -> 'types'), 0) = 0 or (f -> 'types') ? l.type::text)
    and (coalesce(jsonb_array_length(f -> 'periods'), 0) = 0 or (f -> 'periods') ? l.period_id::text)
    and (coalesce(jsonb_array_length(f -> 'positions'), 0) = 0 or (f -> 'positions') ? l.position_id::text)
    and (f ->> 'option' is null or (f ->> 'option')::boolean = l.has_option)
    and (coalesce(jsonb_array_length(f -> 'weekdays'), 0) = 0
         or (f -> 'weekdays') ? extract(dow from l.shift_date)::int::text)
$$;

create or replace function public.notify_new_listing(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.shift_listings; r record;
begin
  select * into l from public.shift_listings where id = p_id;
  if not found then return; end if;

  if l.type in ('offer', 'exchange') then
    -- People whose wants this shift satisfies.
    for r in
      select s.id, s.owner_id from public.shift_listings s
      where s.org_id = l.org_id and s.owner_id <> l.owner_id and s.type in ('seek', 'exchange')
        and s.status in ('active', 'in_coordination') and s.expires_at > now()
        and l.shift_date = any (s.want_dates)
        and (cardinality(s.want_period_ids) = 0 or l.period_id = any (s.want_period_ids))
        and l.position_id = any (s.want_position_ids)
        and (s.want_option_ok or not l.has_option)
        and public.is_qualified(s.owner_id, l.position_id)
        and public.is_member_active(s.owner_id, l.org_id)
    loop
      perform public.push_notification(r.owner_id, l.org_id, 'match', l.id, l.owner_id,
        jsonb_build_object('for_listing', r.id), 'match:' || l.id::text);
    end loop;

    -- Saved searches.
    for r in
      select ss.id, ss.user_id from public.saved_searches ss
      where ss.org_id = l.org_id and ss.notify and ss.user_id <> l.owner_id
        and public.saved_search_matches(ss.filters, l)
        and public.is_qualified(ss.user_id, l.position_id)
        and public.is_member_active(ss.user_id, l.org_id)
    loop
      perform public.push_notification(r.user_id, l.org_id, 'saved_search', l.id, l.owner_id,
        jsonb_build_object('search_id', r.id), 'saved:' || l.id::text);
    end loop;
  end if;

  if l.type in ('seek', 'exchange') then
    -- Owners of shifts this listing is looking for.
    for r in
      select o.id, o.owner_id from public.shift_listings o
      where o.org_id = l.org_id and o.owner_id <> l.owner_id and o.type in ('offer', 'exchange')
        and o.status in ('active', 'in_coordination') and o.expires_at > now()
        and o.shift_date = any (l.want_dates)
        and (cardinality(l.want_period_ids) = 0 or o.period_id = any (l.want_period_ids))
        and o.position_id = any (l.want_position_ids)
        and (l.want_option_ok or not o.has_option)
        and public.is_member_active(o.owner_id, l.org_id)
    loop
      perform public.push_notification(r.owner_id, l.org_id, 'seeker_found', l.id, l.owner_id,
        jsonb_build_object('for_listing', r.id), 'seeker:' || l.id::text);
    end loop;
  end if;
end $$;

-- ===========================================================================
-- Listings
-- ===========================================================================

-- Validates and normalizes a listing row. Raises on invalid input.
create or replace function public.prepare_listing(l public.shift_listings) returns public.shift_listings
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.today_il();
  v_max date := public.today_il() + 60;
  v_start time;
  v_bad int;
begin
  l.note := nullif(btrim(coalesce(l.note, '')), '');
  l.custom_title := nullif(btrim(coalesce(l.custom_title, '')), '');
  if l.custom_title is null then l.custom_start := null; l.custom_end := null; end if;

  if l.type = 'seek' then
    l.shift_date := null; l.period_id := null; l.position_id := null; l.has_option := false;
    l.custom_title := null; l.custom_start := null; l.custom_end := null;
  else
    if l.shift_date is null or l.period_id is null or l.position_id is null then
      raise exception using message = 'invalid_listing';
    end if;
    if l.shift_date < v_today or l.shift_date > v_max then
      raise exception using message = 'date_out_of_range';
    end if;
    if not exists (select 1 from public.shift_periods p where p.id = l.period_id and p.org_id = l.org_id) then
      raise exception using message = 'invalid_period';
    end if;
    if not exists (select 1 from public.positions p where p.id = l.position_id and p.org_id = l.org_id and p.is_active) then
      raise exception using message = 'invalid_position';
    end if;
    if not public.is_qualified(l.owner_id, l.position_id) then
      raise exception using message = 'not_qualified';
    end if;
    select coalesce(l.custom_start, p.start_time) into v_start from public.shift_periods p where p.id = l.period_id;
    l.starts_at := public.shift_start_ts(l.shift_date, v_start);
    if l.starts_at <= now() then raise exception using message = 'shift_started'; end if;
  end if;

  if l.type = 'offer' then
    l.want_dates := '{}'; l.want_period_ids := '{}'; l.want_position_ids := '{}'; l.want_option_ok := true;
    l.expires_at := l.starts_at;
    return l;
  end if;

  -- Want side (seek / exchange)
  select coalesce(array_agg(distinct d order by d), '{}') into l.want_dates
  from unnest(coalesce(l.want_dates, '{}'::date[])) d where d >= v_today;
  if cardinality(l.want_dates) = 0 then raise exception using message = 'want_dates_required'; end if;
  if cardinality(l.want_dates) > 14 or l.want_dates[cardinality(l.want_dates)] > v_max then
    raise exception using message = 'date_out_of_range';
  end if;

  select coalesce(array_agg(distinct x), '{}') into l.want_period_ids from unnest(coalesce(l.want_period_ids, '{}'::uuid[])) x;
  select count(*) into v_bad from unnest(l.want_period_ids) x
  where not exists (select 1 from public.shift_periods p where p.id = x and p.org_id = l.org_id);
  if v_bad > 0 then raise exception using message = 'invalid_period'; end if;

  select coalesce(array_agg(distinct x), '{}') into l.want_position_ids from unnest(coalesce(l.want_position_ids, '{}'::uuid[])) x;
  select count(*) into v_bad from unnest(l.want_position_ids) x
  where not exists (select 1 from public.positions p where p.id = x and p.org_id = l.org_id and p.is_active);
  if v_bad > 0 then raise exception using message = 'invalid_position'; end if;
  select count(*) into v_bad from unnest(l.want_position_ids) x where not public.is_qualified(l.owner_id, x);
  if v_bad > 0 then raise exception using message = 'not_qualified'; end if;
  if cardinality(l.want_position_ids) = 0 then
    -- "Any position" = any position the owner is qualified for (keeps matching qualification-safe).
    select coalesce(array_agg(p.id order by p.sort_order), '{}') into l.want_position_ids
    from public.positions p
    where p.org_id = l.org_id and p.is_active and public.is_qualified(l.owner_id, p.id);
    if cardinality(l.want_position_ids) = 0 then raise exception using message = 'no_qualified_positions'; end if;
  end if;

  if l.type = 'seek' then
    l.starts_at := (l.want_dates[1]::timestamp) at time zone 'Asia/Jerusalem';
    l.expires_at := ((l.want_dates[cardinality(l.want_dates)] + 1)::timestamp) at time zone 'Asia/Jerusalem';
  else
    l.expires_at := l.starts_at;  -- exchange expires when the offered shift begins
  end if;
  return l;
end $$;

create or replace function public.tg_listing_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  s public.organization_settings;
  v_cnt int;
begin
  if v_uid is null then
    if new.org_id is null or new.owner_id is null then raise exception using message = 'invalid_listing'; end if;
  else
    v_org := public.current_org_id();
    if v_org is null then raise exception using message = 'not_member'; end if;
    new.owner_id := v_uid;
    new.org_id := v_org;

    -- Serialize creation per user so rate limits cannot be raced.
    perform pg_advisory_xact_lock(hashtext('listing:' || v_uid::text));
    select * into s from public.organization_settings where org_id = v_org;
    select count(*) into v_cnt from public.shift_listings
    where owner_id = v_uid and status in ('active', 'in_coordination') and expires_at > now();
    if v_cnt >= coalesce(s.max_active_listings, 15) then raise exception using message = 'too_many_active'; end if;
    select count(*) into v_cnt from public.shift_listings
    where owner_id = v_uid and created_at > now() - interval '24 hours';
    if v_cnt >= coalesce(s.max_new_listings_per_day, 20) then raise exception using message = 'rate_limited'; end if;
  end if;

  new.status := 'active';
  new.version := 0;
  new.taken_by := null;
  new.closed_at := null;
  new.removed_reason := null;
  new.created_at := now();
  new.updated_at := now();
  new := public.prepare_listing(new);
  return new;
end $$;

create or replace function public.tg_listing_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_content_changed boolean;
begin
  if new.id <> old.id or new.org_id <> old.org_id or new.owner_id <> old.owner_id
     or new.type <> old.type or new.created_at <> old.created_at then
    raise exception using message = 'immutable_field';
  end if;

  v_content_changed := (new.shift_date, new.period_id, new.position_id, new.has_option, new.custom_title,
                        new.custom_start, new.custom_end, new.want_dates, new.want_period_ids,
                        new.want_position_ids, new.want_option_ok, new.note)
    is distinct from (old.shift_date, old.period_id, old.position_id, old.has_option, old.custom_title,
                      old.custom_start, old.custom_end, old.want_dates, old.want_period_ids,
                      old.want_position_ids, old.want_option_ok, old.note);

  if not public.is_system_context() then
    if old.status not in ('active', 'in_coordination') then raise exception using message = 'listing_closed'; end if;

    if v_uid = old.owner_id then
      if not public.is_member_active(v_uid, old.org_id) then raise exception using message = 'not_member'; end if;
      if old.expires_at <= now() then raise exception using message = 'listing_expired'; end if;
      if new.status not in ('active', 'in_coordination', 'closed_taken', 'closed_cancelled') then
        raise exception using message = 'invalid_status';
      end if;
      new.removed_reason := old.removed_reason;
      if new.status <> 'closed_taken' then
        new.taken_by := null;
      elsif new.taken_by is not null and (new.taken_by = v_uid or not public.is_member_active(new.taken_by, old.org_id)) then
        raise exception using message = 'invalid_member';
      end if;
      if v_content_changed then
        new := public.prepare_listing(new);
      else
        new.starts_at := old.starts_at;
        new.expires_at := old.expires_at;
      end if;
    elsif public.is_org_admin(old.org_id) and new.status = 'removed_by_admin' then
      if v_content_changed or new.taken_by is distinct from old.taken_by
         or new.starts_at <> old.starts_at or new.expires_at <> old.expires_at then
        raise exception using message = 'forbidden';
      end if;
    else
      raise exception using message = 'forbidden';
    end if;
  end if;

  if new.status <> old.status and new.status in ('closed_taken', 'closed_cancelled', 'expired', 'removed_by_admin') then
    new.closed_at := now();
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.tg_listing_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    insert into public.listing_events (org_id, listing_id, actor_id, from_status, to_status)
    values (new.org_id, new.id, auth.uid(), null, new.status);
    perform public.notify_new_listing(new.id);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.listing_events (org_id, listing_id, actor_id, from_status, to_status)
    values (new.org_id, new.id, auth.uid(), old.status, new.status);

    if new.status in ('closed_taken', 'closed_cancelled', 'removed_by_admin') then
      for r in select i.user_id from public.listing_interests i
               where i.listing_id = new.id and i.status in ('open', 'accepted') loop
        perform public.push_notification(r.user_id, new.org_id, 'listing_closed', new.id, new.owner_id,
          jsonb_build_object('status', new.status), 'closed:' || new.id::text);
      end loop;
    end if;
    if new.status = 'removed_by_admin' then
      perform public.push_notification(new.owner_id, new.org_id, 'listing_removed', new.id, auth.uid(),
        jsonb_build_object('reason', new.removed_reason), 'removed:' || new.id::text);
    end if;
  end if;
  return null;
end $$;

create trigger listing_before_insert before insert on public.shift_listings
  for each row execute function public.tg_listing_before_insert();
create trigger listing_before_update before update on public.shift_listings
  for each row execute function public.tg_listing_before_update();
create trigger listing_after after insert or update on public.shift_listings
  for each row execute function public.tg_listing_after();

-- When an admin changes period hours, recompute open listings' start/expiry.
create or replace function public.tg_period_times_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.start_time is distinct from old.start_time then
    perform set_config('shiftex.system', 'on', true);
    update public.shift_listings l
       set starts_at = public.shift_start_ts(l.shift_date, coalesce(l.custom_start, new.start_time)),
           expires_at = public.shift_start_ts(l.shift_date, coalesce(l.custom_start, new.start_time))
     where l.period_id = new.id and l.type <> 'seek' and l.status in ('active', 'in_coordination');
    perform set_config('shiftex.system', 'off', true);
  end if;
  return null;
end $$;
create trigger period_times_changed after update on public.shift_periods
  for each row execute function public.tg_period_times_changed();

-- Called by pg_cron. Queries also filter on expires_at, so correctness never depends on cron.
create or replace function public.expire_listings() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform set_config('shiftex.system', 'on', true);
  update public.shift_listings set status = 'expired'
  where status in ('active', 'in_coordination') and expires_at <= now();
  get diagnostics v_count = row_count;
  perform set_config('shiftex.system', 'off', true);
  return v_count;
end $$;

-- Retention policy (pg_cron, daily).
create or replace function public.run_retention() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_listings();
  delete from public.shift_listings l
  using public.organization_settings s
  where s.org_id = l.org_id
    and l.status in ('closed_taken', 'closed_cancelled', 'expired', 'removed_by_admin')
    and coalesce(l.closed_at, l.expires_at) < now() - make_interval(days => s.closed_retention_days);
  delete from public.notifications where created_at < now() - interval '60 days';
  delete from public.invite_attempts where attempted_at < now() - interval '7 days';
  delete from public.contact_reveals where created_at < now() - interval '90 days';
  delete from public.admin_audit_logs where created_at < now() - interval '2 years';
end $$;

-- ===========================================================================
-- Interests & contact
-- ===========================================================================
create or replace function public.express_interest(p_listing uuid, p_offered uuid default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  l public.shift_listings;
  o public.shift_listings;
  v_id uuid;
  v_cnt int;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  select * into l from public.shift_listings where id = p_listing for update;
  if not found or not public.is_active_member(l.org_id) then raise exception using message = 'not_found'; end if;
  if l.owner_id = v_uid then raise exception using message = 'own_listing'; end if;
  if l.status not in ('active', 'in_coordination') or l.expires_at <= now() then
    raise exception using message = 'listing_closed';
  end if;
  if l.type in ('offer', 'exchange') and not public.is_qualified(v_uid, l.position_id) then
    raise exception using message = 'not_qualified';
  end if;
  if p_note is not null and char_length(p_note) > 280 then raise exception using message = 'invalid_note'; end if;

  if p_offered is not null then
    select * into o from public.shift_listings where id = p_offered;
    if not found or o.owner_id <> v_uid or o.type = 'seek' or o.status not in ('active', 'in_coordination') then
      raise exception using message = 'invalid_offer';
    end if;
    if not public.is_qualified(l.owner_id, o.position_id) then
      raise exception using message = 'owner_not_qualified';
    end if;
  end if;

  select count(*) into v_cnt from public.listing_interests
  where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_cnt >= 40 then raise exception using message = 'rate_limited'; end if;

  insert into public.listing_interests (org_id, listing_id, user_id, offered_listing_id, note, status)
  values (l.org_id, l.id, v_uid, p_offered, nullif(btrim(coalesce(p_note, '')), ''), 'open')
  on conflict (listing_id, user_id) do update
    set offered_listing_id = excluded.offered_listing_id, note = excluded.note, status = 'open'
  returning id into v_id;

  perform public.push_notification(l.owner_id, l.org_id, 'interest', l.id, v_uid,
    jsonb_build_object('interest_id', v_id),
    'interest:' || v_id::text || ':' || (extract(epoch from now())::bigint / 3600)::text);
  return v_id;
end $$;

create or replace function public.set_interest_status(p_interest uuid, p_status public.interest_status) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); i public.listing_interests; l public.shift_listings;
begin
  select * into i from public.listing_interests where id = p_interest for update;
  if not found then raise exception using message = 'not_found'; end if;
  select * into l from public.shift_listings where id = i.listing_id;
  if not public.is_active_member(l.org_id) then raise exception using message = 'not_member'; end if;

  if v_uid = i.user_id then
    if p_status <> 'withdrawn' then raise exception using message = 'forbidden'; end if;
  elsif v_uid = l.owner_id then
    if p_status not in ('open', 'declined', 'accepted') then raise exception using message = 'forbidden'; end if;
  else
    raise exception using message = 'forbidden';
  end if;

  update public.listing_interests set status = p_status where id = p_interest;
  if v_uid = l.owner_id and p_status in ('accepted', 'declined') then
    perform public.push_notification(i.user_id, l.org_id, 'interest_update', l.id, v_uid,
      jsonb_build_object('status', p_status), 'interest_update:' || i.id::text || ':' || p_status::text);
  end if;
end $$;

-- The only path through which another member's phone number can be read.
create or replace function public.get_contact(p_listing uuid, p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  l public.shift_listings;
  v_target uuid;
  v_cnt int;
  v jsonb;
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  select * into l from public.shift_listings where id = p_listing;
  if not found or not public.is_active_member(l.org_id) then raise exception using message = 'not_found'; end if;

  if p_user is null or p_user = l.owner_id then
    v_target := l.owner_id;
    if v_target = v_uid then raise exception using message = 'own_listing'; end if;
    if l.status not in ('active', 'in_coordination') or l.expires_at <= now() then
      raise exception using message = 'listing_closed';
    end if;
    if l.type in ('offer', 'exchange') and not public.is_qualified(v_uid, l.position_id) then
      raise exception using message = 'not_qualified';
    end if;
  else
    -- The owner contacting someone who expressed interest (or the colleague who took the shift).
    if l.owner_id <> v_uid then raise exception using message = 'forbidden'; end if;
    if not exists (select 1 from public.listing_interests i where i.listing_id = l.id and i.user_id = p_user)
       and l.taken_by is distinct from p_user then
      raise exception using message = 'forbidden';
    end if;
    v_target := p_user;
  end if;

  if not public.is_member_active(v_target, l.org_id) then raise exception using message = 'member_unavailable'; end if;

  select count(*) into v_cnt from public.contact_reveals
  where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_cnt >= 60 then raise exception using message = 'rate_limited'; end if;
  insert into public.contact_reveals (user_id, listing_id, target_user_id) values (v_uid, l.id, v_target);

  select jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'phone', pp.phone_e164)
  into v
  from public.profiles p join public.profile_private pp on pp.user_id = p.id
  where p.id = v_target;
  return v;
end $$;

-- Coordinator email + non-sensitive org settings for active members.
create or replace function public.get_org_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) from public.organization_settings s where s.org_id = public.current_org_id()
$$;

-- ===========================================================================
-- Administration (all audited)
-- ===========================================================================
create or replace function public.assert_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null or not public.is_org_admin(v_org) then raise exception using message = 'forbidden'; end if;
  return v_org;
end $$;

create or replace function public.admin_set_member_status(p_user uuid, p_status public.member_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); m public.organization_members; v_ok boolean;
begin
  if p_user = auth.uid() then raise exception using message = 'cannot_target_self'; end if;
  select * into m from public.organization_members where org_id = v_org and user_id = p_user for update;
  if not found then raise exception using message = 'not_found'; end if;

  v_ok := case m.status
    when 'pending'   then p_status in ('active', 'rejected')
    when 'active'    then p_status in ('suspended', 'banned')
    when 'suspended' then p_status in ('active', 'banned')
    else false
  end;
  if not v_ok then raise exception using message = 'invalid_transition'; end if;

  update public.organization_members
     set status = p_status,
         status_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
         approved_by = case when m.status = 'pending' and p_status = 'active' then auth.uid() else approved_by end,
         approved_at = case when m.status = 'pending' and p_status = 'active' then now() else approved_at end,
         role = case when p_status = 'banned' then 'employee'::public.member_role else role end
   where org_id = v_org and user_id = p_user;

  if p_status in ('suspended', 'banned') then
    perform set_config('shiftex.system', 'on', true);
    update public.shift_listings set status = 'removed_by_admin', removed_reason = 'member_inactive'
    where owner_id = p_user and status in ('active', 'in_coordination');
    perform set_config('shiftex.system', 'off', true);
    update public.listing_interests set status = 'withdrawn' where user_id = p_user and status = 'open';
  end if;

  if p_status = 'active' and m.status = 'pending' then
    perform public.push_notification(p_user, v_org, 'account_approved', null, auth.uid(), '{}'::jsonb, 'approved:' || v_org::text);
  elsif p_status = 'active' then
    perform public.push_notification(p_user, v_org, 'account_status', null, auth.uid(),
      jsonb_build_object('status', p_status), 'status:' || p_status::text || ':' || now()::text);
  end if;

  perform public.write_audit(v_org, 'member_status', 'member', p_user::text,
    jsonb_build_object('from', m.status, 'to', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_set_member_role(p_user uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); m public.organization_members;
begin
  select * into m from public.organization_members where org_id = v_org and user_id = p_user for update;
  if not found then raise exception using message = 'not_found'; end if;
  if m.status <> 'active' then raise exception using message = 'invalid_transition'; end if;
  if m.role = 'admin' and p_role = 'employee' and not exists (
       select 1 from public.organization_members x
       where x.org_id = v_org and x.role = 'admin' and x.status = 'active' and x.user_id <> p_user) then
    raise exception using message = 'last_admin';
  end if;
  update public.organization_members set role = p_role where org_id = v_org and user_id = p_user;
  perform public.write_audit(v_org, 'member_role', 'member', p_user::text, jsonb_build_object('from', m.role, 'to', p_role));
end $$;

create or replace function public.admin_set_member_badges(p_user uuid, p_badge_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); v_before jsonb;
begin
  if not exists (select 1 from public.organization_members where org_id = v_org and user_id = p_user) then
    raise exception using message = 'not_found';
  end if;
  select coalesce(jsonb_agg(badge_id), '[]'::jsonb) into v_before from public.member_badges where user_id = p_user;
  delete from public.member_badges where user_id = p_user;
  insert into public.member_badges (org_id, user_id, badge_id, assigned_by)
  select v_org, p_user, b.id, auth.uid() from public.badges b
  where b.org_id = v_org and b.id = any (coalesce(p_badge_ids, '{}'::uuid[]));
  perform public.write_audit(v_org, 'member_badges', 'member', p_user::text,
    jsonb_build_object('before', v_before, 'after', to_jsonb(coalesce(p_badge_ids, '{}'::uuid[]))));
end $$;

create or replace function public.admin_list_members() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'role', m.role, 'status', m.status, 'status_reason', m.status_reason,
      'created_at', m.created_at, 'approved_at', m.approved_at,
      'full_name', p.full_name, 'avatar_url', p.avatar_url, 'email', pp.email, 'phone', pp.phone_e164,
      'badge_ids', coalesce((select jsonb_agg(mb.badge_id) from public.member_badges mb where mb.user_id = m.user_id), '[]'::jsonb),
      'self_selected', exists (select 1 from public.member_badges mb where mb.user_id = m.user_id and mb.assigned_by is null)
    ) order by (m.status = 'pending') desc, p.full_name), '[]'::jsonb)
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  left join public.profile_private pp on pp.user_id = m.user_id
  where m.org_id = public.assert_admin()
$$;

create or replace function public.admin_create_invite(p_label text, p_max_uses int, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); v_code text; v_id uuid;
begin
  if p_expires_at is not null and p_expires_at <= now() then raise exception using message = 'invalid_expiry'; end if;
  v_code := public.generate_invite_code();
  insert into public.organization_invites (org_id, code_hash, code_hint, label, max_uses, expires_at, created_by)
  values (v_org, public.hash_invite_code(v_code), left(v_code, 2) || '…' || right(v_code, 2),
          nullif(left(btrim(coalesce(p_label, '')), 60), ''), coalesce(p_max_uses, 50), p_expires_at, auth.uid())
  returning id into v_id;
  perform public.write_audit(v_org, 'invite_create', 'invite', v_id::text,
    jsonb_build_object('label', p_label, 'max_uses', p_max_uses, 'expires_at', p_expires_at));
  return jsonb_build_object('id', v_id, 'code', v_code);  -- plaintext returned exactly once
end $$;

create or replace function public.admin_revoke_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin();
begin
  update public.organization_invites set revoked_at = now() where id = p_id and org_id = v_org and revoked_at is null;
  if not found then raise exception using message = 'not_found'; end if;
  perform public.write_audit(v_org, 'invite_revoke', 'invite', p_id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_remove_listing(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); l public.shift_listings;
begin
  select * into l from public.shift_listings where id = p_id and org_id = v_org for update;
  if not found then raise exception using message = 'not_found'; end if;
  if l.status not in ('active', 'in_coordination') then raise exception using message = 'listing_closed'; end if;
  update public.shift_listings
     set status = 'removed_by_admin', removed_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), '')
   where id = p_id;
  perform public.write_audit(v_org, 'listing_remove', 'listing', p_id::text,
    jsonb_build_object('owner_id', l.owner_id, 'reason', p_reason));
end $$;

create or replace function public.admin_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  with o as (select public.assert_admin() as org_id)
  select jsonb_build_object(
    'pending', (select count(*) from public.organization_members m, o where m.org_id = o.org_id and m.status = 'pending'),
    'active_members', (select count(*) from public.organization_members m, o where m.org_id = o.org_id and m.status = 'active'),
    'suspended', (select count(*) from public.organization_members m, o where m.org_id = o.org_id and m.status in ('suspended', 'banned')),
    'open_listings', (select count(*) from public.shift_listings l, o where l.org_id = o.org_id
                       and l.status in ('active', 'in_coordination') and l.expires_at > now()),
    'listings_7d', (select count(*) from public.shift_listings l, o where l.org_id = o.org_id and l.created_at > now() - interval '7 days'),
    'closed_taken_30d', (select count(*) from public.shift_listings l, o where l.org_id = o.org_id
                          and l.status = 'closed_taken' and l.closed_at > now() - interval '30 days'),
    'periods_missing_times', (select count(*) from public.shift_periods p, o where p.org_id = o.org_id and p.start_time is null),
    'coordinator_email_set', (select s.coordinator_email is not null from public.organization_settings s, o where s.org_id = o.org_id)
  )
$$;

-- ===========================================================================
-- Bootstrap (run ONCE from the Supabase SQL editor; never callable by clients)
-- ===========================================================================
create or replace function public.bootstrap_organization(p_org_name text, p_admin_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_user uuid;
begin
  if exists (select 1 from public.organizations) then
    raise exception 'Already bootstrapped: an organization exists.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_admin_email));
  if v_user is null then
    raise exception 'No user with email %. Sign in to the app with Google once, then run this again.', p_admin_email;
  end if;
  perform public.ensure_profile(v_user);

  insert into public.organizations (name) values (btrim(p_org_name)) returning id into v_org;
  insert into public.organization_settings (org_id) values (v_org);
  insert into public.shift_periods (org_id, code, label, sort_order) values
    (v_org, 'morning', 'בוקר', 1),
    (v_org, 'afternoon', 'צהריים', 2),
    (v_org, 'night', 'לילה', 3),
    (v_org, 'oncall', 'כונן', 4);
  delete from public.organization_members where user_id = v_user;
  insert into public.organization_members (org_id, user_id, role, status, approved_at)
  values (v_org, v_user, 'admin', 'active', now());
  insert into public.admin_audit_logs (org_id, actor_id, action, target_type, target_id)
  values (v_org, v_user, 'bootstrap', 'organization', v_org::text);
  return v_org;
end $$;

-- Liveness probe (used by the keep-alive workflow). Reveals nothing.
create or replace function public.health() returns boolean
language sql stable set search_path = '' as $$ select true $$;
