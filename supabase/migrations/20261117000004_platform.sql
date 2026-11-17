-- ShiftEX Market — Supabase platform integration: scheduled jobs, Realtime, Storage.
-- (Kept separate from the portable schema so the database test-suite can run without these services.)

-- ---------------------------------------------------------------------------
-- Scheduled jobs (pg_cron is available on the Supabase Free plan)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('shiftex-expire-listings', '*/10 * * * *', $$select public.expire_listings()$$);
select cron.schedule('shiftex-retention', '30 2 * * *', $$select public.run_retention()$$);

-- ---------------------------------------------------------------------------
-- Realtime: only the two tables the UI subscribes to. RLS is enforced per subscriber.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shift_listings;
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: avatars (≤ 300 KB, images only; client resizes to 256px WebP first)
-- Files live under avatars/<user-id>/<random>.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: owner can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner can update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
