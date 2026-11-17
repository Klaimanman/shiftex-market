-- ShiftEX Market — Row Level Security & privileges.
-- Principle: deny by default. Clients read through RLS; every privileged or
-- multi-row write goes through a SECURITY DEFINER function with its own checks.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.organizations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.profile_private          enable row level security;
alter table public.organization_members     enable row level security;
alter table public.organization_invites     enable row level security;
alter table public.invite_attempts          enable row level security;
alter table public.organization_settings    enable row level security;
alter table public.shift_periods            enable row level security;
alter table public.positions                enable row level security;
alter table public.badges                   enable row level security;
alter table public.badge_positions          enable row level security;
alter table public.member_badges            enable row level security;
alter table public.shift_listings           enable row level security;
alter table public.listing_events           enable row level security;
alter table public.listing_interests        enable row level security;
alter table public.saved_searches           enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.contact_reveals          enable row level security;
alter table public.admin_audit_logs         enable row level security;

-- ---------------------------------------------------------------------------
-- Organizations & people
-- ---------------------------------------------------------------------------
create policy org_select on public.organizations for select to authenticated
  using (public.is_active_member(id));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.user_id = profiles.id
        and m.org_id = public.current_org_id()
        and (m.status = 'active' or public.is_org_admin(m.org_id))
    )
  );

create policy profile_private_select on public.profile_private for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.user_id = profile_private.user_id and public.is_org_admin(m.org_id)
    )
  );

create policy members_select on public.organization_members for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_active_member(org_id) and (status = 'active' or public.is_org_admin(org_id)))
  );

create policy invites_select on public.organization_invites for select to authenticated
  using (public.is_org_admin(org_id));

create policy settings_select on public.organization_settings for select to authenticated
  using (public.is_active_member(org_id));
create policy settings_update on public.organization_settings for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Reference data: members read, admins write
-- ---------------------------------------------------------------------------
create policy periods_select on public.shift_periods for select to authenticated
  using (public.is_active_member(org_id));
create policy periods_update on public.shift_periods for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy positions_select on public.positions for select to authenticated
  using (public.is_active_member(org_id));
create policy positions_insert on public.positions for insert to authenticated
  with check (public.is_org_admin(org_id));
create policy positions_update on public.positions for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy positions_delete on public.positions for delete to authenticated
  using (public.is_org_admin(org_id));

create policy badges_select on public.badges for select to authenticated
  using (public.is_active_member(org_id));
create policy badges_insert on public.badges for insert to authenticated
  with check (public.is_org_admin(org_id));
create policy badges_update on public.badges for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy badges_delete on public.badges for delete to authenticated
  using (public.is_org_admin(org_id));

create policy badge_positions_select on public.badge_positions for select to authenticated
  using (public.is_active_member(org_id));
create policy badge_positions_insert on public.badge_positions for insert to authenticated
  with check (exists (select 1 from public.badges b where b.id = badge_id and public.is_org_admin(b.org_id)));
create policy badge_positions_delete on public.badge_positions for delete to authenticated
  using (public.is_org_admin(org_id));

create policy member_badges_select on public.member_badges for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------
create policy listings_select on public.shift_listings for select to authenticated
  using (public.is_active_member(org_id));
-- Insert/update rows are additionally validated & normalized by triggers.
create policy listings_insert on public.shift_listings for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_member(org_id));
create policy listings_update on public.shift_listings for update to authenticated
  using (owner_id = auth.uid() and public.is_active_member(org_id))
  with check (owner_id = auth.uid() and public.is_active_member(org_id));
-- No delete policy: listings are closed/cancelled, never hard-deleted by users.

create policy listing_events_select on public.listing_events for select to authenticated
  using (
    public.is_org_admin(org_id)
    or exists (select 1 from public.shift_listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

create policy interests_select on public.listing_interests for select to authenticated
  using (
    public.is_active_member(org_id) and (
      user_id = auth.uid()
      or public.is_org_admin(org_id)
      or exists (select 1 from public.shift_listings l where l.id = listing_id and l.owner_id = auth.uid())
    )
  );

create policy saved_searches_all on public.saved_searches for all to authenticated
  using (user_id = auth.uid() and public.is_active_member(org_id))
  with check (user_id = auth.uid() and public.is_active_member(org_id));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy notif_prefs_all on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select on public.admin_audit_logs for select to authenticated
  using (public.is_org_admin(org_id));

-- invite_attempts, contact_reveals: no policies -> no client access at all.

-- ---------------------------------------------------------------------------
-- Saved searches: force org, cap count
-- ---------------------------------------------------------------------------
create or replace function public.tg_saved_search_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.org_id := public.current_org_id();
    if new.org_id is null then raise exception using message = 'not_member'; end if;
    if tg_op = 'INSERT' and (select count(*) from public.saved_searches where user_id = new.user_id) >= 10 then
      raise exception using message = 'too_many_saved_searches';
    end if;
  end if;
  return new;
end $$;
create trigger saved_search_guard before insert or update on public.saved_searches
  for each row execute function public.tg_saved_search_guard();

-- Notifications: users may only toggle read_at.
create or replace function public.tg_notification_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new := old;  -- discard everything...
    new.read_at := coalesce(new.read_at, now());  -- ...except marking as read
  end if;
  return new;
end $$;
create trigger notification_guard before update on public.notifications
  for each row execute function public.tg_notification_guard();

-- ---------------------------------------------------------------------------
-- Table privileges (RLS still applies on top)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;
grant insert, update on public.shift_listings to authenticated;
grant insert, update, delete on public.saved_searches to authenticated;
grant update, delete on public.notifications to authenticated;
grant insert, update on public.notification_preferences to authenticated;
grant insert, update, delete on public.positions, public.badges to authenticated;
grant insert, delete on public.badge_positions to authenticated;
grant update on public.shift_periods, public.organization_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is executable unless granted explicitly
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.current_org_id(),
  public.is_active_member(uuid),
  public.is_org_admin(uuid),
  public.is_qualified(uuid, uuid),
  public.my_context(),
  public.save_my_profile(text, text),
  public.set_my_avatar(text),
  public.delete_my_account(),
  public.validate_invite(text),
  public.join_organization(text, uuid[]),
  public.express_interest(uuid, uuid, text),
  public.set_interest_status(uuid, public.interest_status),
  public.get_contact(uuid, uuid),
  public.get_org_settings(),
  public.admin_set_member_status(uuid, public.member_status, text),
  public.admin_set_member_role(uuid, public.member_role),
  public.admin_set_member_badges(uuid, uuid[]),
  public.admin_list_members(),
  public.admin_create_invite(text, int, timestamptz),
  public.admin_revoke_invite(uuid),
  public.admin_remove_listing(uuid, text),
  public.admin_stats()
to authenticated;

grant execute on function public.health() to anon, authenticated;
-- bootstrap_organization, expire_listings, run_retention: owner/postgres only.
