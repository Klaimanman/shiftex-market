-- Invite codes stay viewable by administrators (requested by the org owner), and can be
-- effectively unlimited. Employees still cannot read invites at all (RLS: admins only).
-- The hash remains the lookup key; the plaintext is kept only for admin display.

alter table public.organization_invites
  add column if not exists code text check (code is null or char_length(code) <= 16);

alter table public.organization_invites drop constraint if exists organization_invites_max_uses_check;
alter table public.organization_invites
  add constraint organization_invites_max_uses_check check (max_uses between 1 and 1000000);

create or replace function public.admin_create_invite(p_label text, p_max_uses int, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid := public.assert_admin(); v_code text; v_id uuid;
begin
  if p_expires_at is not null and p_expires_at <= now() then raise exception using message = 'invalid_expiry'; end if;
  v_code := public.generate_invite_code();
  insert into public.organization_invites (org_id, code_hash, code_hint, code, label, max_uses, expires_at, created_by)
  values (v_org, public.hash_invite_code(v_code), left(v_code, 2) || '…' || right(v_code, 2), v_code,
          nullif(left(btrim(coalesce(p_label, '')), 60), ''),
          least(greatest(coalesce(p_max_uses, 1000000), 1), 1000000), p_expires_at, auth.uid())
  returning id into v_id;
  perform public.write_audit(v_org, 'invite_create', 'invite', v_id::text,
    jsonb_build_object('label', p_label, 'max_uses', p_max_uses, 'expires_at', p_expires_at));
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

revoke execute on function public.admin_create_invite(text, int, timestamptz) from public, anon;
grant execute on function public.admin_create_invite(text, int, timestamptz) to authenticated;
