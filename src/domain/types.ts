import type { ISODate } from './dates';

export type ListingType = 'offer' | 'seek' | 'exchange';
export type ListingStatus = 'active' | 'in_coordination' | 'closed_taken' | 'closed_cancelled' | 'expired' | 'removed_by_admin';
export type PeriodCode = 'port' | 'morning' | 'afternoon' | 'night' | 'oncall';
export type MemberRole = 'employee' | 'admin';
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'banned' | 'rejected';
export type InterestStatus = 'open' | 'withdrawn' | 'declined' | 'accepted';

export interface ShiftPeriod {
  id: string;
  org_id: string;
  code: PeriodCode;
  label: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
}

export interface Position {
  id: string;
  org_id: string;
  name: string;
  requires_qualification: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Badge {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface BadgePosition {
  badge_id: string;
  position_id: string;
}

export interface MiniProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Listing {
  id: string;
  org_id: string;
  owner_id: string;
  type: ListingType;
  status: ListingStatus;
  shift_date: ISODate | null;
  period_id: string | null;
  position_id: string | null;
  has_option: boolean;
  custom_title: string | null;
  custom_start: string | null;
  custom_end: string | null;
  want_dates: ISODate[];
  want_period_ids: string[];
  want_position_ids: string[];
  want_option_ok: boolean;
  note: string | null;
  starts_at: string;
  expires_at: string;
  taken_by: string | null;
  removed_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  owner?: MiniProfile | null;
}

export interface Membership {
  org_id: string;
  org_name: string;
  role: MemberRole;
  status: MemberStatus;
  status_reason: string | null;
  created_at: string;
}

export interface MyContext {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  onboarded: boolean;
  email: string;
  phone: string | null;
  membership: Membership | null;
  badge_ids: string[];
  badge_names: string[];
  qualified_position_ids: string[];
}

export interface Interest {
  id: string;
  org_id: string;
  listing_id: string;
  user_id: string;
  offered_listing_id: string | null;
  note: string | null;
  status: InterestStatus;
  created_at: string;
  updated_at: string;
  user?: MiniProfile | null;
}

export interface MarketFilters {
  types: ListingType[];
  periods: string[];
  positions: string[];
  /** null = any; true = only with 12h option; false = only without */
  option: boolean | null;
  qualifiedOnly: boolean;
}

export const EMPTY_FILTERS: MarketFilters = { types: [], periods: [], positions: [], option: null, qualifiedOnly: false };

export interface OrgSettings {
  org_id: string;
  coordinator_email: string | null;
  max_active_listings: number;
  max_new_listings_per_day: number;
  closed_retention_days: number;
}

export interface AppNotification {
  id: string;
  kind:
    | 'match' | 'seeker_found' | 'saved_search' | 'interest' | 'interest_update'
    | 'listing_closed' | 'listing_removed' | 'account_approved' | 'account_status' | 'member_pending';
  listing_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor?: MiniProfile | null;
  listing?: Pick<Listing, 'id' | 'type' | 'shift_date' | 'period_id' | 'position_id' | 'custom_title' | 'status' | 'want_dates'> | null;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: Partial<MarketFilters> & { weekdays?: string[] };
  notify: boolean;
  created_at: string;
}
