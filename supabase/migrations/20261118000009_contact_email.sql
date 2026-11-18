-- The coordinator email is sent by one guard with the other guard in CC, so the
-- counterpart's email is now returned together with the phone number.
-- Same rules as before (audited, rate-limited, counterpart only), plus: the colleague
-- recorded as `taken_by` may fetch the owner's contact after the listing was closed.

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
    if l.taken_by is distinct from v_uid then
      if l.status not in ('active', 'in_coordination') or l.expires_at <= now() then
        raise exception using message = 'listing_closed';
      end if;
      if l.type in ('offer', 'exchange') and not public.is_qualified(v_uid, l.position_id) then
        raise exception using message = 'not_qualified';
      end if;
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

  select jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'phone', pp.phone_e164, 'email', pp.email)
  into v
  from public.profiles p join public.profile_private pp on pp.user_id = p.id
  where p.id = v_target;
  return v;
end $$;

revoke execute on function public.get_contact(uuid, uuid) from public, anon;
grant execute on function public.get_contact(uuid, uuid) to authenticated;
