-- Listings for positions that require a certification (מסוף, סיורים, בכיר...) are
-- visible only to employees qualified for them. Enforced in RLS, not only in the UI.
-- Always visible to: the owner, the employee who took it, and organization admins.
--   offer / exchange: the viewer must be qualified for the listing's position.
--   seek: the viewer must be qualified for at least one of the wanted positions.

create or replace function public.can_view_listing(
  p_org uuid, p_owner uuid, p_taken_by uuid, p_type public.listing_type, p_position uuid, p_want_positions uuid[]
) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_member(p_org)
    and (
      p_owner = auth.uid()
      or p_taken_by = auth.uid()
      or public.is_org_admin(p_org)
      or (p_type <> 'seek' and (p_position is null or public.is_qualified(auth.uid(), p_position)))
      or (p_type = 'seek' and (
            cardinality(p_want_positions) = 0
            or exists (select 1 from unnest(p_want_positions) w where public.is_qualified(auth.uid(), w))
          ))
    )
$$;

revoke all on function public.can_view_listing(uuid, uuid, uuid, public.listing_type, uuid, uuid[]) from public;
grant execute on function public.can_view_listing(uuid, uuid, uuid, public.listing_type, uuid, uuid[]) to authenticated;

drop policy if exists listings_select on public.shift_listings;
create policy listings_select on public.shift_listings for select to authenticated
  using (public.can_view_listing(org_id, owner_id, taken_by, type, position_id, want_position_ids));
