-- "נמל" is a POSITION (selected by default when posting), not a shift period.

-- Listings that used the Port shift keep working as special shifts named "נמל" only if they had
-- custom hours; otherwise they are re-pointed to the morning shift (no data loss for owners).
update public.shift_listings l
set period_id = (select m.id from public.shift_periods m where m.org_id = l.org_id and m.code = 'morning')
where l.period_id in (select id from public.shift_periods where code = 'port');

update public.shift_listings l
set want_period_ids = array_remove(l.want_period_ids, p.id)
from public.shift_periods p
where p.code = 'port' and p.org_id = l.org_id and p.id = any (l.want_period_ids);

delete from public.shift_periods where code = 'port';

-- Port position, first in the list, open to everyone (admins can restrict it later).
insert into public.positions (org_id, name, requires_qualification, sort_order)
select o.id, 'נמל', false, 0 from public.organizations o
where not exists (select 1 from public.positions p where p.org_id = o.id and lower(btrim(p.name)) = 'נמל');

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
    (v_org, 'oncall', 'כונן בוקר', 4),
    (v_org, 'oncall_afternoon', 'כונן צהריים', 5),
    (v_org, 'oncall_night', 'כונן לילה', 6);
  insert into public.positions (org_id, name, requires_qualification, sort_order) values (v_org, 'נמל', false, 0);
  delete from public.organization_members where user_id = v_user;
  insert into public.organization_members (org_id, user_id, role, status, approved_at)
  values (v_org, v_user, 'admin', 'active', now());
  insert into public.admin_audit_logs (org_id, actor_id, action, target_type, target_id)
  values (v_org, v_user, 'bootstrap', 'organization', v_org::text);
  return v_org;
end $$;

revoke execute on function public.bootstrap_organization(text, text) from public, anon, authenticated;
