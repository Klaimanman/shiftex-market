import { describe, expect, it } from 'vitest';
import {
  addDays, dayOfWeek, diffDays, formatLong, formatWeekRange, isISODate, startOfWeek, stripBidi,
  todayIL, weekDays, zonedToInstant, tzOffsetMinutes,
} from '@/domain/dates';

describe('week calculations (Sunday start)', () => {
  it('Sunday is day 0 and starts its own week', () => {
    expect(dayOfWeek('2026-11-15')).toBe(0);
    expect(startOfWeek('2026-11-15')).toBe('2026-11-15');
  });

  it('Saturday belongs to the week that started the previous Sunday', () => {
    expect(startOfWeek('2026-11-21')).toBe('2026-11-15');
  });

  it('crosses a month boundary', () => {
    const days = weekDays(startOfWeek('2026-12-02'));
    expect(days[0]).toBe('2026-11-29');
    expect(days[6]).toBe('2026-12-05');
    expect(formatWeekRange(days[0])).toBe('29 בנובמבר – 5 בדצמבר 2026');
  });

  it('crosses a year boundary', () => {
    const days = weekDays(startOfWeek('2027-01-01'));
    expect(days[0]).toBe('2026-12-27');
    expect(days[6]).toBe('2027-01-02');
    expect(formatWeekRange(days[0])).toBe('27 בדצמבר 2026 – 2 בינואר 2027');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(isISODate('2027-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
  });

  it('day arithmetic is unaffected by DST transitions', () => {
    // Israel DST 2026: starts Fri 27 Mar, ends Sun 25 Oct
    expect(addDays('2026-03-26', 1)).toBe('2026-03-27');
    expect(addDays('2026-03-27', 1)).toBe('2026-03-28');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
    expect(weekDays(startOfWeek('2026-10-25'))).toHaveLength(7);
  });

  it('same-month range format (numeric range isolated as LTR)', () => {
    expect(formatWeekRange('2026-11-15')).toBe('⁦15–21⁩ בנובמבר 2026');
    expect(stripBidi(formatWeekRange('2026-11-15'))).toBe('15–21 בנובמבר 2026');
  });

  it('formats long Hebrew dates', () => {
    expect(formatLong('2026-11-17')).toBe('יום שלישי, 17 בנובמבר');
  });
});

describe('Asia/Jerusalem time zone', () => {
  it('today is computed in Israel, not UTC', () => {
    // 22:30 UTC on 17 Nov = 00:30 on 18 Nov in Israel (UTC+2 in winter)
    expect(todayIL(new Date('2026-11-17T22:30:00Z'))).toBe('2026-11-18');
    // 20:30 UTC on 1 Jul = 23:30 in Israel (UTC+3 in summer)
    expect(todayIL(new Date('2026-07-01T20:30:00Z'))).toBe('2026-07-01');
  });

  it('offsets are +2 in winter and +3 in summer', () => {
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(120);
    expect(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(180);
  });

  it('converts local shift starts to instants across DST start', () => {
    expect(zonedToInstant('2026-03-26', '08:00').toISOString()).toBe('2026-03-26T06:00:00.000Z');
    expect(zonedToInstant('2026-03-27', '08:00').toISOString()).toBe('2026-03-27T05:00:00.000Z');
  });

  it('converts local shift starts to instants across DST end', () => {
    expect(zonedToInstant('2026-10-24', '08:00').toISOString()).toBe('2026-10-24T05:00:00.000Z');
    expect(zonedToInstant('2026-10-25', '08:00').toISOString()).toBe('2026-10-25T06:00:00.000Z');
    expect(zonedToInstant('2026-10-25', '23:00').toISOString()).toBe('2026-10-25T21:00:00.000Z');
  });
});
