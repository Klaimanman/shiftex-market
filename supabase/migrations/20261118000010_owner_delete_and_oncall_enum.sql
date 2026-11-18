-- 1) Owners may delete their own listings (e.g. once the shift was taken).
--    Interests, events and notifications for the listing are removed by FK cascade.
create policy listings_delete on public.shift_listings for delete to authenticated
  using (owner_id = auth.uid() and public.is_active_member(org_id));
grant delete on public.shift_listings to authenticated;

-- 2) On-call per shift: "כונן בוקר / כונן צהריים / כונן לילה".
--    (New enum values must be committed before use; rows are added in the next migration.)
alter type public.period_code add value if not exists 'oncall_afternoon';
alter type public.period_code add value if not exists 'oncall_night';
