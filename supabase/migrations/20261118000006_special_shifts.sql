-- Special (non-standard) shifts: an offer/exchange may have NO regular period when it
-- carries its own name and start/end times (e.g. "משמרת אירוע 16:00–22:00").

alter table public.shift_listings drop constraint if exists listing_give_side;
alter table public.shift_listings add constraint listing_give_side check (
  type = 'seek'
  or (
    shift_date is not null and position_id is not null
    and (period_id is not null or (custom_title is not null and custom_start is not null and custom_end is not null))
  )
);

create or replace function public.prepare_listing(l public.shift_listings) returns public.shift_listings
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.today_il();
  v_max date := public.today_il() + 60;
  v_start time;
  v_bad int;
begin
  l.note := nullif(btrim(coalesce(l.note, '')), '');
  l.custom_title := nullif(btrim(coalesce(l.custom_title, '')), '');
  if l.custom_title is null then l.custom_start := null; l.custom_end := null; end if;

  if l.type = 'seek' then
    l.shift_date := null; l.period_id := null; l.position_id := null; l.has_option := false;
    l.custom_title := null; l.custom_start := null; l.custom_end := null;
  else
    if l.shift_date is null or l.position_id is null then
      raise exception using message = 'invalid_listing';
    end if;
    if l.period_id is null then
      -- Special shift: name and hours are mandatory.
      if l.custom_title is null or l.custom_start is null or l.custom_end is null then
        raise exception using message = 'special_shift_incomplete';
      end if;
    elsif not exists (select 1 from public.shift_periods p where p.id = l.period_id and p.org_id = l.org_id) then
      raise exception using message = 'invalid_period';
    end if;
    if l.shift_date < v_today or l.shift_date > v_max then
      raise exception using message = 'date_out_of_range';
    end if;
    if not exists (select 1 from public.positions p where p.id = l.position_id and p.org_id = l.org_id and p.is_active) then
      raise exception using message = 'invalid_position';
    end if;
    if not public.is_qualified(l.owner_id, l.position_id) then
      raise exception using message = 'not_qualified';
    end if;
    if l.period_id is null then
      v_start := l.custom_start;
    else
      select coalesce(l.custom_start, p.start_time) into v_start from public.shift_periods p where p.id = l.period_id;
    end if;
    l.starts_at := public.shift_start_ts(l.shift_date, v_start);
    if l.starts_at <= now() then raise exception using message = 'shift_started'; end if;
  end if;

  if l.type = 'offer' then
    l.want_dates := '{}'; l.want_period_ids := '{}'; l.want_position_ids := '{}'; l.want_option_ok := true;
    l.expires_at := l.starts_at;
    return l;
  end if;

  -- Want side (seek / exchange)
  select coalesce(array_agg(distinct d order by d), '{}') into l.want_dates
  from unnest(coalesce(l.want_dates, '{}'::date[])) d where d >= v_today;
  if cardinality(l.want_dates) = 0 then raise exception using message = 'want_dates_required'; end if;
  if cardinality(l.want_dates) > 14 or l.want_dates[cardinality(l.want_dates)] > v_max then
    raise exception using message = 'date_out_of_range';
  end if;

  select coalesce(array_agg(distinct x), '{}') into l.want_period_ids from unnest(coalesce(l.want_period_ids, '{}'::uuid[])) x;
  select count(*) into v_bad from unnest(l.want_period_ids) x
  where not exists (select 1 from public.shift_periods p where p.id = x and p.org_id = l.org_id);
  if v_bad > 0 then raise exception using message = 'invalid_period'; end if;

  select coalesce(array_agg(distinct x), '{}') into l.want_position_ids from unnest(coalesce(l.want_position_ids, '{}'::uuid[])) x;
  select count(*) into v_bad from unnest(l.want_position_ids) x
  where not exists (select 1 from public.positions p where p.id = x and p.org_id = l.org_id and p.is_active);
  if v_bad > 0 then raise exception using message = 'invalid_position'; end if;
  select count(*) into v_bad from unnest(l.want_position_ids) x where not public.is_qualified(l.owner_id, x);
  if v_bad > 0 then raise exception using message = 'not_qualified'; end if;
  if cardinality(l.want_position_ids) = 0 then
    select coalesce(array_agg(p.id order by p.sort_order), '{}') into l.want_position_ids
    from public.positions p
    where p.org_id = l.org_id and p.is_active and public.is_qualified(l.owner_id, p.id);
    if cardinality(l.want_position_ids) = 0 then raise exception using message = 'no_qualified_positions'; end if;
  end if;

  if l.type = 'seek' then
    l.starts_at := (l.want_dates[1]::timestamp) at time zone 'Asia/Jerusalem';
    l.expires_at := ((l.want_dates[cardinality(l.want_dates)] + 1)::timestamp) at time zone 'Asia/Jerusalem';
  else
    l.expires_at := l.starts_at;
  end if;
  return l;
end $$;
