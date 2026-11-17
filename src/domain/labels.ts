import type { ListingStatus, ListingType, MemberStatus, PeriodCode } from './types';

export const TYPE_LABEL: Record<ListingType, string> = {
  offer: 'מסירה',
  seek: 'חיפוש',
  exchange: 'החלפה',
};

export const TYPE_TITLE: Record<ListingType, string> = {
  offer: 'מסירת משמרת',
  seek: 'חיפוש משמרת',
  exchange: 'החלפת משמרת',
};

export const TYPE_HINT: Record<ListingType, string> = {
  offer: 'יש לך משמרת שלא מתאימה לך — לפרסם אותה למי שרוצה לקחת.',
  seek: 'מחפשים משמרת נוספת בתאריכים מסוימים.',
  exchange: 'להציע משמרת שלך תמורת משמרת אחרת.',
};

export const STATUS_LABEL: Record<ListingStatus, string> = {
  active: 'פעילה',
  in_coordination: 'בתיאום',
  closed_taken: 'נסגרה — נלקחה',
  closed_cancelled: 'נסגרה — בוטלה',
  expired: 'פג תוקף',
  removed_by_admin: 'הוסרה ע״י ההנהלה',
};

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  pending: 'ממתין לאישור',
  active: 'פעיל',
  suspended: 'מושעה',
  banned: 'גישה בוטלה',
  rejected: 'נדחה',
};

export const PERIOD_FALLBACK: Record<PeriodCode, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  night: 'לילה',
  oncall: 'כונן',
};

export const OPTION_LABEL = 'אופציה ל־12 שעות';
