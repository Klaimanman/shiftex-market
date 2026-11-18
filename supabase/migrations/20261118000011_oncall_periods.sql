-- The existing on-call shift becomes "כונן בוקר"; afternoon and night on-call are added.
update public.shift_periods set label = 'כונן בוקר', sort_order = 4 where code = 'oncall' and label = 'כונן';

insert into public.shift_periods (org_id, code, label, sort_order)
select o.id, x.code::public.period_code, x.label, x.sort_order
from public.organizations o
cross join (values ('oncall_afternoon', 'כונן צהריים', 5), ('oncall_night', 'כונן לילה', 6)) as x(code, label, sort_order)
on conflict (org_id, code) do nothing;

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
    (v_org, 'port', 'נמל', 0),
    (v_org, 'morning', 'בוקר', 1),
    (v_org, 'afternoon', 'צהריים', 2),
    (v_org, 'night', 'לילה', 3),
    (v_org, 'oncall', 'כונן בוקר', 4),
    (v_org, 'oncall_afternoon', 'כונן צהריים', 5),
    (v_org, 'oncall_night', 'כונן לילה', 6);
  delete from public.organization_members where user_id = v_user;
  insert into public.organization_members (org_id, user_id, role, status, approved_at)
  values (v_org, v_user, 'admin', 'active', now());
  insert into public.admin_audit_logs (org_id, actor_id, action, target_type, target_id)
  values (v_org, v_user, 'bootstrap', 'organization', v_org::text);
  return v_org;
end $$;

revoke execute on function public.bootstrap_organization(text, text) from public, anon, authenticated;
