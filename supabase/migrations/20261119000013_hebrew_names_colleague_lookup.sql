-- 1) Display name must be written in Hebrew (it is used in the coordinator emails).
create or replace function public.save_my_profile(p_full_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := public.normalize_il_mobile(p_phone);
begin
  if v_uid is null then raise exception using message = 'not_authenticated'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception using message = 'invalid_name';
  end if;
  if v_name !~ '[א-ת]' then raise exception using message = 'name_not_hebrew'; end if;
  if v_phone is null then raise exception using message = 'invalid_phone'; end if;
  if exists (select 1 from public.profile_private where phone_e164 = v_phone and user_id <> v_uid) then
    raise exception using message = 'phone_taken';
  end if;
  perform public.ensure_profile(v_uid);
  update public.profiles set full_name = v_name, onboarded_at = coalesce(onboarded_at, now()) where id = v_uid;
  update public.profile_private set phone_e164 = v_phone, updated_at = now() where user_id = v_uid;
  return public.my_context();
end $$;

-- 2) Colleague lookup for the coordinator email CC: active members of the caller's group,
--    searched by name or email. Returns display name + email only (no phone).
create or replace function public.search_colleagues(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.current_org_id();
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if v_uid is null or v_org is null then raise exception using message = 'not_member'; end if;
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', x.id, 'full_name', x.full_name, 'email', x.email) order by x.full_name)
    from (
      select p.id, p.full_name, pp.email
      from public.organization_members m
      join public.profiles p on p.id = m.user_id
      join public.profile_private pp on pp.user_id = m.user_id
      where m.org_id = v_org and m.status = 'active' and m.user_id <> v_uid
        and (lower(p.full_name) like '%' || q || '%' or lower(pp.email) like '%' || q || '%')
      order by p.full_name
      limit 8
    ) x), '[]'::jsonb);
end $$;

revoke execute on function public.save_my_profile(text, text) from public, anon;
grant execute on function public.save_my_profile(text, text) to authenticated;
revoke execute on function public.search_colleagues(text) from public, anon;
grant execute on function public.search_colleagues(text) to authenticated;
