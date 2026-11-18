/**
 * DEV-ONLY demo backend (`npm run dev:demo`). Intercepts Supabase REST calls with
 * fictional sample data so the UI can be reviewed without a database.
 * Never included in production builds (guarded by import.meta.env.VITE_DEMO).
 */
import { addDays, startOfWeek, todayIL } from '@/domain/dates';

const ORG = '11111111-1111-4111-8111-111111111111';
const ME = '22222222-2222-4222-8222-222222222222';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const periods = [
  { id: id(101), org_id: ORG, code: 'morning', label: 'בוקר', start_time: '07:00:00', end_time: '15:00:00', sort_order: 1 },
  { id: id(102), org_id: ORG, code: 'afternoon', label: 'צהריים', start_time: '15:00:00', end_time: '23:00:00', sort_order: 2 },
  { id: id(103), org_id: ORG, code: 'night', label: 'לילה', start_time: '23:00:00', end_time: '07:00:00', sort_order: 3 },
  { id: id(104), org_id: ORG, code: 'oncall', label: 'כונן בוקר', start_time: null, end_time: null, sort_order: 4 },
  { id: id(105), org_id: ORG, code: 'oncall_afternoon', label: 'כונן צהריים', start_time: null, end_time: null, sort_order: 5 },
  { id: id(106), org_id: ORG, code: 'oncall_night', label: 'כונן לילה', start_time: null, end_time: null, sort_order: 6 },
];
const positions = [
  { id: id(200), org_id: ORG, name: 'נמל', requires_qualification: false, is_active: true, sort_order: 0 },
  { id: id(201), org_id: ORG, name: 'עמדה א', requires_qualification: true, is_active: true, sort_order: 1 },
  { id: id(202), org_id: ORG, name: 'עמדה ב', requires_qualification: false, is_active: true, sort_order: 2 },
  { id: id(203), org_id: ORG, name: 'סיור 1', requires_qualification: true, is_active: true, sort_order: 3 },
  { id: id(204), org_id: ORG, name: 'סיור 2', requires_qualification: true, is_active: true, sort_order: 4 },
  { id: id(205), org_id: ORG, name: 'סיור מיוחד', requires_qualification: true, is_active: true, sort_order: 5 },
];
const badges = [
  { id: id(301), org_id: ORG, name: 'סיור', description: 'סיור 1, סיור 2', is_active: true, sort_order: 1 },
  { id: id(302), org_id: ORG, name: 'בכיר', description: 'סיור מיוחד', is_active: true, sort_order: 2 },
];
const links = [
  { badge_id: id(301), position_id: id(203) },
  { badge_id: id(301), position_id: id(204) },
  { badge_id: id(302), position_id: id(205) },
];
const people = [
  { id: ME, full_name: 'דמו משתמש', avatar_url: null },
  { id: id(401), full_name: 'נועה לוי', avatar_url: null },
  { id: id(402), full_name: 'אבי כהן', avatar_url: null },
  { id: id(403), full_name: 'שירן מזרחי', avatar_url: null },
  { id: id(404), full_name: 'יוסי פרץ', avatar_url: null },
];

function buildListings() {
  const t = todayIL();
  const ws = startOfWeek(t);
  const d = (n: number) => addDays(t, n);
  const base = {
    org_id: ORG, status: 'active', has_option: false, custom_title: null, custom_start: null, custom_end: null,
    want_dates: [] as string[], want_period_ids: [] as string[], want_position_ids: [] as string[], want_option_ok: true,
    note: null as string | null, taken_by: null, removed_reason: null, version: 0, closed_at: null,
  };
  const far = new Date(Date.now() + 30 * 86400000).toISOString();
  const mk = (n: number, o: Record<string, unknown>, ownerIdx: number, hoursAgo: number) => ({
    ...base, id: id(500 + n), owner_id: people[ownerIdx].id, owner: people[ownerIdx],
    starts_at: far, expires_at: far, created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
    updated_at: new Date().toISOString(), ...o,
  });
  void ws;
  return [
    mk(1, { type: 'offer', shift_date: d(1), period_id: id(101), position_id: id(202), note: 'אפשר להתחיל חצי שעה מאוחר יותר' }, 1, 30),
    mk(2, { type: 'offer', shift_date: d(1), period_id: id(103), position_id: id(203), has_option: true }, 2, 20),
    mk(3, { type: 'seek', want_dates: [d(1), d(2)], want_period_ids: [id(101)], want_position_ids: [id(202), id(203)] }, 3, 10),
    mk(4, { type: 'exchange', shift_date: d(2), period_id: id(102), position_id: id(202), want_dates: [d(3)], want_period_ids: [id(101)], want_position_ids: [id(202)] }, 4, 8),
    mk(5, { type: 'offer', shift_date: d(1), period_id: id(102), position_id: id(205), custom_title: 'משמרת אירוע', custom_start: '16:00:00', custom_end: '22:00:00' }, 1, 5),
    mk(6, { type: 'offer', shift_date: d(3), period_id: id(104), position_id: id(202) }, 2, 3),
    mk(7, { type: 'seek', want_dates: [d(1)], want_period_ids: [], want_position_ids: [id(202)] }, 0, 2),
    mk(8, { type: 'offer', shift_date: d(4), period_id: id(101), position_id: id(204), status: 'in_coordination' }, 3, 1),
    mk(9, { type: 'offer', shift_date: d(2), period_id: id(101), position_id: id(202) }, 0, 1),
  ];
}

const context = () => ({
  user_id: ME, full_name: 'דמו משתמש', avatar_url: null, onboarded: true, email: 'demo@example.com', phone: '+972501234567',
  membership: { org_id: ORG, org_name: 'ארגון לדוגמה', role: 'admin', status: 'active', status_reason: null, created_at: new Date().toISOString() },
  badge_ids: [id(301)], badge_names: ['סיור'], qualified_position_ids: [id(202), id(203), id(204)],
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }));
}

export function installDemo() {
  const listings = buildListings();
  const notifications = [
    { id: id(601), kind: 'match', listing_id: listings[0].id, actor_id: people[1].id, payload: {}, read_at: null, created_at: new Date(Date.now() - 600000).toISOString(), actor: people[1], listing: listings[0] },
    { id: id(602), kind: 'interest', listing_id: listings[8].id, actor_id: people[3].id, payload: {}, read_at: null, created_at: new Date(Date.now() - 3600000).toISOString(), actor: people[3], listing: listings[8] },
    { id: id(603), kind: 'account_approved', listing_id: null, actor_id: null, payload: {}, read_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000 * 2).toISOString(), actor: null, listing: null },
  ];
  // Fake, non-verifiable session (the demo backend never checks it).
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const token = `${b64({ alg: 'none' })}.${b64({ sub: ME, exp, role: 'authenticated' })}.demo`;
  localStorage.setItem(
    'shiftex-auth',
    JSON.stringify({ access_token: token, refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: ME, email: 'demo@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }),
  );

  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/auth/v1/') && !url.pathname.startsWith('/storage/v1/')) return realFetch(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const accept = new Headers(init?.headers).get('accept') ?? '';
    const single = accept.includes('vnd.pgrst.object');
    const path = url.pathname.replace('/rest/v1/', '');
    const eq = (k: string) => url.searchParams.get(k)?.replace(/^eq\./, '');

    if (url.pathname.startsWith('/auth/v1/user')) return json({ id: ME, email: 'demo@example.com', aud: 'authenticated' });
    if (url.pathname.startsWith('/auth/v1/')) return json({});

    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      const r: Record<string, unknown> = {
        my_context: context(),
        get_org_settings: { org_id: ORG, coordinator_email: 'scheduling@example.com', max_active_listings: 15, max_new_listings_per_day: 20, closed_retention_days: 90 },
        get_contact: { user_id: people[1].id, full_name: people[1].full_name, phone: '+972521112233' },
        admin_stats: { pending: 2, active_members: 48, suspended: 1, open_listings: listings.length, listings_7d: 23, closed_taken_30d: 17, periods_missing_times: 1, coordinator_email_set: true },
        admin_list_members: people.map((p, i) => ({ user_id: p.id, role: i === 0 ? 'admin' : 'employee', status: i === 4 ? 'pending' : 'active', status_reason: null, created_at: new Date().toISOString(), approved_at: null, full_name: p.full_name, avatar_url: null, email: `user${i}@example.com`, phone: `+97250000000${i}`, badge_ids: i % 2 ? [id(301)] : [], self_selected: i === 4 })),
        admin_create_invite: { id: id(701), code: 'K7Q2M-X9HPA' },
      };
      return json(r[fn] ?? null);
    }

    if (method === 'HEAD') return Promise.resolve(new Response(null, { status: 200, headers: { 'content-range': `0-0/${notifications.filter((n) => !n.read_at).length}` } }));
    if (method !== 'GET') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const row = Array.isArray(body) ? body[0] : body;
      const existing = listings.find((l) => l.id === eq('id'));
      const merged = { ...(existing ?? listings[0]), ...row, owner: people[0], owner_id: ME, version: (existing?.version ?? 0) + 1 };
      return json(single ? merged : [merged], 200);
    }

    const tables: Record<string, unknown[]> = {
      shift_periods: periods,
      positions,
      badges,
      badge_positions: links,
      organization_members: people.map((p) => ({ user_id: p.id, profile: p })),
      shift_listings: listings,
      notifications,
      notification_preferences: [],
      saved_searches: [{ id: id(801), name: 'לילות בסיור', filters: { periods: [id(103)], positions: [id(203)] }, notify: true, created_at: new Date().toISOString() }],
      listing_interests: path === 'listing_interests' && eq('listing_id') === listings[8].id ? [{ id: id(901), org_id: ORG, listing_id: listings[8].id, user_id: people[3].id, offered_listing_id: null, note: 'מתאים לי, אשמח לדבר', status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user: people[3] }] : [],
      organization_invites: [{ id: id(702), code_hint: 'K7…PA', label: 'גיוס נובמבר', max_uses: 50, use_count: 12, expires_at: new Date(Date.now() + 20 * 86400000).toISOString(), revoked_at: null, created_at: new Date().toISOString() }],
      admin_audit_logs: [{ id: 1, actor_id: ME, action: 'member_status', target_type: 'member', target_id: people[2].id, details: { to: 'active' }, created_at: new Date().toISOString() }],
    };
    let rows = (tables[path] ?? []) as Record<string, unknown>[];
    if (path === 'shift_listings') {
      const idf = eq('id');
      const owner = eq('owner_id');
      if (idf) rows = rows.filter((r) => r.id === idf);
      if (owner) rows = rows.filter((r) => r.owner_id === owner);
    }
    if (single) return rows[0] ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
    return json(rows);
  };
}
