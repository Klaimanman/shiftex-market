-- "נמל" becomes the first (default) regular shift in every organization.
insert into public.shift_periods (org_id, code, label, sort_order)
select o.id, 'port', 'נמל', 0 from public.organizations o
on conflict (org_id, code) do nothing;

-- New organizations get it too.
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
    (v_org, 'oncall', 'כונן', 4);
  delete from public.organization_members where user_id = v_user;
  insert into public.organization_members (org_id, user_id, role, status, approved_at)
  values (v_org, v_user, 'admin', 'active', now());
  insert into public.admin_audit_logs (org_id, actor_id, action, target_type, target_id)
  values (v_org, v_user, 'bootstrap', 'organization', v_org::text);
  return v_org;
end $$;

revoke execute on function public.bootstrap_organization(text, text) from public, anon, authenticated;
