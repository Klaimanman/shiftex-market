import { beforeAll, describe, expect, it } from 'vitest';
import { TestDb, uid } from './harness';

/**
 * End-to-end authorization scenarios against the real migrations.
 * Users:
 *   ADMIN  – bootstrapped administrator
 *   SENIOR – employee with the "senior" badge (qualified for the restricted position)
 *   BASIC  – employee without badges
 *   OTHER  – employee used for ban / pending scenarios
 */
const ADMIN = uid(1);
const SENIOR = uid(2);
const BASIC = uid(3);
const OTHER = uid(4);
const OUTSIDER = uid(5);

let db: TestDb;
let org: string;
let posOpen: string;
let posRestricted: string;
let badgeSenior: string;
let morning: string;
let night: string;
let inviteCode: string;

const future = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
};

async function onboard(user: string, name: string, phone: string, badges: string[] = []) {
  await db.as(user, `select public.save_my_profile($1, $2)`, [name, phone]);
  const [r] = await db.as<{ j: { ok: boolean; error?: string } }>(
    user,
    `select public.join_organization($1, $2::uuid[]) as j`,
    [inviteCode, `{${badges.join(',')}}`],
  );
  expect(r.j.ok).toBe(true);
}

async function createOffer(user: string, opts: { date?: string; position?: string; period?: string } = {}) {
  const [row] = await db.as<{ id: string }>(
    user,
    `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
     values ('offer', $1, $2, $3, $4, auth.uid(), now(), now()) returning id`,
    [opts.date ?? future(3), opts.period ?? morning, opts.position ?? posOpen, org],
  );
  return row.id;
}

beforeAll(async () => {
  db = await TestDb.create();
  await db.createAuthUser(ADMIN, 'admin@example.com', 'Admin User');
  await db.createAuthUser(SENIOR, 'senior@example.com', 'Senior User');
  await db.createAuthUser(BASIC, 'basic@example.com', 'Basic User');
  await db.createAuthUser(OTHER, 'other@example.com', 'Other User');
  await db.createAuthUser(OUTSIDER, 'outsider@example.com', 'Outsider');

  // Admin completes the profile step, then bootstrap runs from the SQL editor.
  await db.as(ADMIN, `select public.save_my_profile('Admin User', '050-0000001')`);
  const [b] = await db.system<{ id: string }>(`select public.bootstrap_organization('Test Org', 'admin@example.com') as id`);
  org = b.id;
  [{ id: posOpen }] = await db.system(`insert into public.positions (org_id, name, sort_order) values ($1, 'Open', 1) returning id`, [org]);
  [{ id: posRestricted }] = await db.system(
    `insert into public.positions (org_id, name, requires_qualification, sort_order) values ($1, 'Restricted 53', true, 2) returning id`,
    [org],
  );
  [{ id: badgeSenior }] = await db.system(`insert into public.badges (org_id, name) values ($1, 'Senior') returning id`, [org]);
  await db.system(`insert into public.badge_positions (org_id, badge_id, position_id) values ($1, $2, $3)`, [org, badgeSenior, posRestricted]);
  [{ id: morning }] = await db.system(`select id from public.shift_periods where org_id = $1 and code = 'morning'`, [org]);
  [{ id: night }] = await db.system(`select id from public.shift_periods where org_id = $1 and code = 'night'`, [org]);
  await db.as(ADMIN, `update public.shift_periods set start_time = '07:00', end_time = '15:00' where id = $1`, [morning]);
  await db.as(ADMIN, `update public.shift_periods set start_time = '23:00', end_time = '07:00' where id = $1`, [night]);

  const [inv] = await db.as<{ j: { code: string } }>(ADMIN, `select public.admin_create_invite('test', 10, null) as j`);
  inviteCode = inv.j.code;
}, 120_000);

describe('bootstrap & admin provisioning', () => {
  it('bootstrap cannot run twice', async () => {
    await expect(db.system(`select public.bootstrap_organization('X', 'admin@example.com')`)).rejects.toThrow(/Already bootstrapped/);
  });

  it('clients cannot call bootstrap', async () => {
    expect(await db.asError(BASIC, `select public.bootstrap_organization('X', 'basic@example.com')`)).toMatch(/permission denied/);
  });

  it('admin context reports an active admin', async () => {
    const [r] = await db.as<{ c: any }>(ADMIN, `select public.my_context() as c`);
    expect(r.c.membership.role).toBe('admin');
    expect(r.c.membership.status).toBe('active');
  });
});

describe('onboarding & invitations', () => {
  it('rejects invalid Israeli phone numbers', async () => {
    expect(await db.asError(BASIC, `select public.save_my_profile('Basic User', '03-1234567')`)).toMatch(/invalid_phone/);
  });

  it('a wrong code is rejected and recorded; 5 failures lock the user out for an hour', async () => {
    await db.as(OUTSIDER, `select public.save_my_profile('Outsider', '052-9999999')`);
    for (let i = 0; i < 5; i++) {
      const [r] = await db.as<{ j: any }>(OUTSIDER, `select public.validate_invite('WRONG-CODE') as j`);
      expect(r.j.ok).toBe(false);
    }
    const [r] = await db.as<{ j: any }>(OUTSIDER, `select public.join_organization($1, '{}') as j`, [inviteCode]);
    expect(r.j).toEqual({ ok: false, error: 'too_many_attempts' });
  });

  it('a valid code creates a PENDING membership with no marketplace access', async () => {
    await onboard(BASIC, 'Basic User', '050-1111111');
    const [ctx] = await db.as<{ c: any }>(BASIC, `select public.my_context() as c`);
    expect(ctx.c.membership.status).toBe('pending');
    expect(await db.as(BASIC, `select * from public.shift_periods`)).toHaveLength(0);
    expect(await db.asError(BASIC, `select public.get_org_settings()`)).toBeNull();
  });

  it('employees cannot approve themselves or anyone else', async () => {
    expect(await db.asError(BASIC, `select public.admin_set_member_status($1, 'active')`, [BASIC])).toMatch(/forbidden/);
    expect(await db.asError(BASIC, `update public.organization_members set status = 'active' where user_id = $1`, [BASIC])).toMatch(
      /permission denied/,
    );
  });

  it('admin approves; access is granted immediately', async () => {
    await db.as(ADMIN, `select public.admin_set_member_status($1, 'active')`, [BASIC]);
    expect((await db.as(BASIC, `select * from public.shift_periods`)).length).toBe(5);
  });

  it('self-selected badges are stored and become qualifications after approval', async () => {
    await onboard(SENIOR, 'Senior User', '050-2222222', [badgeSenior]);
    await db.as(ADMIN, `select public.admin_set_member_status($1, 'active')`, [SENIOR]);
    const [r] = await db.as<{ q: boolean }>(SENIOR, `select public.is_qualified(auth.uid(), $1) as q`, [posRestricted]);
    expect(r.q).toBe(true);
  });

  it('employees cannot grant themselves badges after onboarding', async () => {
    expect(await db.asError(BASIC, `insert into public.member_badges (org_id, user_id, badge_id) values ($1, $2, $3)`, [org, BASIC, badgeSenior])).toMatch(
      /permission denied/,
    );
    expect(await db.asError(BASIC, `select public.admin_set_member_badges($1, $2::uuid[])`, [BASIC, `{${badgeSenior}}`])).toMatch(/forbidden/);
  });

  it('a phone number cannot be claimed twice', async () => {
    await db.as(OTHER, `select 1`); // ensure profile exists via trigger
    expect(await db.asError(OTHER, `select public.save_my_profile('Other User', '0501111111')`)).toMatch(/phone_taken/);
  });
});

describe('listings: qualification, ownership, validation', () => {
  it('an unqualified employee cannot offer a restricted (53) shift', async () => {
    expect(await db.asError(BASIC, `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
      values ('offer', $1, $2, $3, $4, auth.uid(), now(), now())`, [future(2), morning, posRestricted, org])).toMatch(/not_qualified/);
  });

  it('an unqualified employee cannot express interest in or get contact for a restricted shift', async () => {
    const id = await createOffer(SENIOR, { position: posRestricted, date: future(4) });
    expect(await db.asError(BASIC, `select public.express_interest($1)`, [id])).toMatch(/not_qualified/);
    expect(await db.asError(BASIC, `select public.get_contact($1)`, [id])).toMatch(/not_qualified/);
    // ...but can still see that it exists (visible but locked)
    expect(await db.as(BASIC, `select id from public.shift_listings where id = $1`, [id])).toHaveLength(1);
  });

  it('server computes owner/org and status; client-sent values are ignored', async () => {
    const [row] = await db.as<any>(
      BASIC,
      `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, status, starts_at, expires_at)
       values ('offer', $1, $2, $3, $4, $5, 'closed_taken', now(), now()) returning *`,
      [future(5), morning, posOpen, org, BASIC],
    );
    expect(row.owner_id).toBe(BASIC);
    expect(row.status).toBe('active');
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects dates in the past', async () => {
    expect(await db.asError(BASIC, `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
      values ('offer', '2020-01-01', $1, $2, $3, auth.uid(), now(), now())`, [morning, posOpen, org])).toMatch(/date_out_of_range/);
  });

  it('prevents accidental duplicate open listings', async () => {
    await createOffer(BASIC, { date: future(6) });
    expect(await db.asError(BASIC, `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
      values ('offer', $1, $2, $3, $4, auth.uid(), now(), now())`, [future(6), morning, posOpen, org])).toMatch(/duplicate|unique/i);
  });

  it("a user cannot modify another employee's listing", async () => {
    const id = await createOffer(SENIOR, { date: future(7) });
    const rows = await db.as(BASIC, `update public.shift_listings set note = 'hacked' where id = $1 returning id`, [id]);
    expect(rows).toHaveLength(0);
    const [l] = await db.system<any>(`select note from public.shift_listings where id = $1`, [id]);
    expect(l.note).toBeNull();
  });

  it('owners cannot impersonate admin removal or change immutable fields', async () => {
    const id = await createOffer(BASIC, { date: future(8) });
    expect(await db.asError(BASIC, `update public.shift_listings set status = 'removed_by_admin' where id = $1`, [id])).toMatch(/invalid_status/);
    expect(await db.asError(BASIC, `update public.shift_listings set type = 'seek' where id = $1`, [id])).toMatch(/immutable_field/);
  });

  it('users cannot hard-delete listings', async () => {
    const id = await createOffer(BASIC, { date: future(9) });
    expect(await db.asError(BASIC, `delete from public.shift_listings where id = $1`, [id])).toMatch(/permission denied/);
  });

  it('optimistic concurrency: two users acting on the same version — only one wins', async () => {
    const id = await createOffer(BASIC, { date: future(10) });
    const [{ version }] = await db.system<{ version: number }>(`select version from public.shift_listings where id = $1`, [id]);
    const a = await db.as(BASIC, `update public.shift_listings set status = 'in_coordination' where id = $1 and version = $2 returning id`, [id, version]);
    const b = await db.as(BASIC, `update public.shift_listings set status = 'closed_cancelled' where id = $1 and version = $2 returning id`, [id, version]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });

  it('closed listings cannot be edited again', async () => {
    const id = await createOffer(BASIC, { date: future(11) });
    await db.as(BASIC, `update public.shift_listings set status = 'closed_cancelled' where id = $1`, [id]);
    expect(await db.asError(BASIC, `update public.shift_listings set status = 'active' where id = $1`, [id])).toMatch(/listing_closed/);
  });

  it('closing as taken requires a valid colleague', async () => {
    const id = await createOffer(BASIC, { date: future(12) });
    expect(await db.asError(BASIC, `update public.shift_listings set status = 'closed_taken', taken_by = $2 where id = $1`, [id, OUTSIDER])).toMatch(
      /invalid_member/,
    );
    await db.as(BASIC, `update public.shift_listings set status = 'closed_taken', taken_by = $2 where id = $1`, [id, SENIOR]);
    const [l] = await db.system<any>(`select status, taken_by, closed_at from public.shift_listings where id = $1`, [id]);
    expect(l.status).toBe('closed_taken');
    expect(l.taken_by).toBe(SENIOR);
    expect(l.closed_at).not.toBeNull();
  });

  it('a seek listing stores qualified positions when "any position" was chosen', async () => {
    const [row] = await db.as<any>(
      BASIC,
      `insert into public.shift_listings (type, want_dates, org_id, owner_id, starts_at, expires_at)
       values ('seek', $1::date[], $2, auth.uid(), now(), now()) returning want_position_ids`,
      [`{${future(3)}}`, org],
    );
    expect(row.want_position_ids).toEqual([posOpen]); // not the restricted one
  });

  it('a shift expires when it begins', async () => {
    const id = await createOffer(BASIC, { date: future(13) });
    await db.system(`select set_config('shiftex.system','on',false)`);
    await db.system(`update public.shift_listings set expires_at = now() - interval '1 minute' where id = $1`, [id]);
    await db.system(`select set_config('shiftex.system','off',false)`);
    const [r] = await db.system<{ n: number }>(`select public.expire_listings() as n`);
    expect(r.n).toBeGreaterThanOrEqual(1);
    const [l] = await db.system<any>(`select status from public.shift_listings where id = $1`, [id]);
    expect(l.status).toBe('expired');
    expect(await db.asError(BASIC, `update public.shift_listings set status = 'in_coordination' where id = $1`, [id])).toMatch(/listing_closed/);
  });

  it('special shift without a regular period requires name and hours, and starts at its own time', async () => {
    const date = future(19);
    expect(await db.asError(BASIC, `insert into public.shift_listings (type, shift_date, position_id, org_id, owner_id, starts_at, expires_at)
      values ('offer', $1, $2, $3, auth.uid(), now(), now())`, [date, posOpen, org])).toMatch(/special_shift_incomplete/);
    const [row] = await db.as<any>(
      BASIC,
      `insert into public.shift_listings (type, shift_date, position_id, custom_title, custom_start, custom_end, note, org_id, owner_id, starts_at, expires_at)
       values ('offer', $1, $2, 'משמרת אירוע', '16:30', '22:00', 'כנס במתחם', $3, auth.uid(), now(), now()) returning *`,
      [date, posOpen, org],
    );
    expect(row.period_id).toBeNull();
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(row.starts_at),
    );
    expect(local).toBe('16:30');
  });

  it('night shift start is computed in Asia/Jerusalem', async () => {
    const date = future(14);
    const [row] = await db.as<any>(
      BASIC,
      `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
       values ('offer', $1, $2, $3, $4, auth.uid(), now(), now()) returning starts_at`,
      [date, night, posOpen, org],
    );
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(row.starts_at),
    );
    expect(local).toBe('23:00');
  });
});

describe('privacy', () => {
  it("members cannot read each other's phone numbers directly", async () => {
    expect(await db.as(BASIC, `select * from public.profile_private where user_id = $1`, [SENIOR])).toHaveLength(0);
    expect(await db.as(BASIC, `select * from public.profile_private where user_id = $1`, [BASIC])).toHaveLength(1);
  });

  it('get_contact reveals a phone only for an open listing, and logs it', async () => {
    const id = await createOffer(SENIOR, { date: future(15) });
    const [r] = await db.as<{ c: any }>(BASIC, `select public.get_contact($1) as c`, [id]);
    expect(r.c.phone).toBe('+972502222222');
    const [log] = await db.system<{ n: number }>(`select count(*)::int as n from public.contact_reveals where user_id = $1`, [BASIC]);
    expect(log.n).toBeGreaterThan(0);
  });

  it('the taker and the owner can get each other\'s email after closing (for the coordinator CC)', async () => {
    const id = await createOffer(SENIOR, { date: future(22) });
    // before closing, an unrelated member may contact the owner, and gets the email too
    const [open] = await db.as<{ c: any }>(BASIC, `select public.get_contact($1) as c`, [id]);
    expect(open.c.email).toBe('senior@example.com');
    await db.as(SENIOR, `update public.shift_listings set status = 'closed_taken', taken_by = $2 where id = $1`, [id, BASIC]);
    const [ownerSide] = await db.as<{ c: any }>(SENIOR, `select public.get_contact($1, $2) as c`, [id, BASIC]);
    expect(ownerSide.c.email).toBe('basic@example.com');
    const [takerSide] = await db.as<{ c: any }>(BASIC, `select public.get_contact($1) as c`, [id]);
    expect(takerSide.c.email).toBe('senior@example.com');
    // a third member cannot get it once the listing is closed
    expect(await db.asError(ADMIN, `select public.get_contact($1)`, [id])).toMatch(/listing_closed|not_qualified/);
  });

  it('admins can read contact details of their members', async () => {
    expect(await db.as(ADMIN, `select * from public.profile_private where user_id = $1`, [BASIC])).toHaveLength(1);
  });

  it('invite codes are viewable by admins only, and unlimited codes work', async () => {
    expect(await db.as(BASIC, `select * from public.organization_invites`)).toHaveLength(0);
    const rows = await db.as<any>(ADMIN, `select code from public.organization_invites where code = $1`, [inviteCode]);
    expect(rows).toHaveLength(1);
    const [u] = await db.as<{ j: any }>(ADMIN, `select public.admin_create_invite('permanent', null, null) as j`);
    const [inv] = await db.as<any>(ADMIN, `select max_uses, expires_at, code from public.organization_invites where id = $1`, [u.j.id]);
    expect(inv.max_uses).toBe(1000000);
    expect(inv.expires_at).toBeNull();
    expect(inv.code).toBe(u.j.code);
  });
});

describe('banned / suspended users', () => {
  it('ban takes effect immediately and removes their open listings', async () => {
    await onboard(OTHER, 'Other User', '050-4444444');
    await db.as(ADMIN, `select public.admin_set_member_status($1, 'active')`, [OTHER]);
    const id = await createOffer(OTHER, { date: future(16) });
    expect((await db.as(OTHER, `select id from public.shift_listings`)).length).toBeGreaterThan(0);

    await db.as(ADMIN, `select public.admin_set_member_status($1, 'banned', 'test')`, [OTHER]);

    expect(await db.as(OTHER, `select id from public.shift_listings`)).toHaveLength(0);
    expect(await db.asError(OTHER, `insert into public.shift_listings (type, shift_date, period_id, position_id, org_id, owner_id, starts_at, expires_at)
      values ('offer', $1, $2, $3, $4, auth.uid(), now(), now())`, [future(17), morning, posOpen, org])).toMatch(/not_member|row-level security/);
    const [l] = await db.system<any>(`select status from public.shift_listings where id = $1`, [id]);
    expect(l.status).toBe('removed_by_admin');
    // a banned user cannot rejoin with an invite code
    expect(await db.asError(OTHER, `select public.join_organization($1, '{}')`, [inviteCode])).toMatch(/banned/);
  });

  it('an admin cannot ban themselves and the last admin cannot be demoted', async () => {
    expect(await db.asError(ADMIN, `select public.admin_set_member_status($1, 'banned')`, [ADMIN])).toMatch(/cannot_target_self/);
    expect(await db.asError(ADMIN, `select public.admin_set_member_role($1, 'employee')`, [ADMIN])).toMatch(/last_admin/);
  });

  it('admin actions are audited; employees cannot read the audit log', async () => {
    expect((await db.as(ADMIN, `select * from public.admin_audit_logs`)).length).toBeGreaterThan(0);
    expect(await db.as(BASIC, `select * from public.admin_audit_logs`)).toHaveLength(0);
  });
});

describe('admin configuration', () => {
  it('employees cannot modify positions, badges, periods or settings', async () => {
    expect(await db.asError(BASIC, `insert into public.positions (org_id, name) values ($1, 'X')`, [org])).toMatch(/row-level security/);
    expect(await db.as(BASIC, `update public.shift_periods set start_time = '01:00' returning id`)).toHaveLength(0);
    expect(await db.as(BASIC, `update public.organization_settings set coordinator_email = 'x@y.z' returning org_id`)).toHaveLength(0);
  });

  it('admin can set the coordinator email; members can read it', async () => {
    await db.as(ADMIN, `update public.organization_settings set coordinator_email = 'coord@example.com' where org_id = $1`, [org]);
    const [r] = await db.as<{ s: any }>(BASIC, `select public.get_org_settings() as s`);
    expect(r.s.coordinator_email).toBe('coord@example.com');
  });

  it('admin can remove a listing; the owner is notified', async () => {
    const id = await createOffer(SENIOR, { date: future(18) });
    await db.as(ADMIN, `select public.admin_remove_listing($1, 'inappropriate')`, [id]);
    const n = await db.as<any>(SENIOR, `select kind from public.notifications where listing_id = $1`, [id]);
    expect(n.map((x: any) => x.kind)).toContain('listing_removed');
  });
});

describe('matching notifications', () => {
  it('a new offer notifies a matching seeker exactly once', async () => {
    const date = future(20);
    await db.as(BASIC, `insert into public.shift_listings (type, want_dates, want_period_ids, org_id, owner_id, starts_at, expires_at)
      values ('seek', $1::date[], $2::uuid[], $3, auth.uid(), now(), now())`, [`{${date}}`, `{${morning}}`, org]);
    const id = await createOffer(SENIOR, { date, period: morning, position: posOpen });
    const n = await db.as<any>(BASIC, `select kind from public.notifications where listing_id = $1`, [id]);
    expect(n).toEqual([{ kind: 'match' }]);
  });

  it('seekers are not notified about restricted shifts they are not qualified for', async () => {
    const date = future(21);
    await db.as(BASIC, `insert into public.shift_listings (type, want_dates, org_id, owner_id, starts_at, expires_at)
      values ('seek', $1::date[], $2, auth.uid(), now(), now())`, [`{${date}}`, org]);
    const id = await createOffer(SENIOR, { date, position: posRestricted });
    expect(await db.as(BASIC, `select 1 from public.notifications where listing_id = $1`, [id])).toHaveLength(0);
  });

  it('users can only mark their notifications as read', async () => {
    const [n] = await db.as<any>(BASIC, `select id, kind from public.notifications limit 1`);
    await db.as(BASIC, `update public.notifications set kind = 'account_approved', read_at = now() where id = $1`, [n.id]);
    const [after] = await db.system<any>(`select kind, read_at from public.notifications where id = $1`, [n.id]);
    expect(after.kind).toBe(n.kind);
    expect(after.read_at).not.toBeNull();
  });
});
