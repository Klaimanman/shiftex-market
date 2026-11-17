-- ShiftEX Market — one-time organization setup (EXAMPLE with generic names).
--
-- 1. Run all files in supabase/migrations first (or `supabase db push`).
-- 2. Open the deployed app and sign in with Google ONCE using the admin's account.
--    Fill in the profile step, then stop at the invite-code step.
-- 3. Copy this file to setup.local.sql (git-ignored), put your real values in it,
--    and run it in Supabase Dashboard → SQL Editor.
-- 4. Refresh the app: you are now the administrator.

do $$
declare
  v_org uuid;
  p_a uuid; p_b uuid; p_c uuid; p_d uuid;
  b_1 uuid; b_2 uuid;
begin
  v_org := public.bootstrap_organization('Example Org', 'admin@example.com');

  insert into public.positions (org_id, name, requires_qualification, sort_order) values
    (v_org, 'Position A', false, 1) returning id into p_a;
  insert into public.positions (org_id, name, requires_qualification, sort_order) values
    (v_org, 'Position B', false, 2) returning id into p_b;
  insert into public.positions (org_id, name, requires_qualification, sort_order) values
    (v_org, 'Restricted C', true, 3) returning id into p_c;
  insert into public.positions (org_id, name, requires_qualification, sort_order) values
    (v_org, 'Restricted D', true, 4) returning id into p_d;

  insert into public.badges (org_id, name, description, sort_order) values
    (v_org, 'Badge 1', 'Qualified for C', 1) returning id into b_1;
  insert into public.badges (org_id, name, description, sort_order) values
    (v_org, 'Senior', 'Qualified for C and D', 2) returning id into b_2;

  insert into public.badge_positions (org_id, badge_id, position_id) values
    (v_org, b_1, p_c),
    (v_org, b_2, p_c),
    (v_org, b_2, p_d);
end $$;
