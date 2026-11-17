import { z } from 'zod';
import { isISODate } from './dates';
import { normalizeILMobile } from './phone';

/** Client-side validation for fast feedback. The database re-validates everything. */

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'יש להזין שם מלא')
    .max(80, 'השם ארוך מדי')
    .regex(/\p{L}/u, 'יש להזין שם מלא'),
  phone: z.string().refine((v) => normalizeILMobile(v) !== null, 'מספר נייד ישראלי לא תקין. לדוגמה: 050-1234567'),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'שעה לא תקינה');

export const listingFormSchema = z
  .object({
    type: z.enum(['offer', 'seek', 'exchange']),
    shiftDate: z.string(),
    periodId: z.string(),
    positionId: z.string(),
    hasOption: z.boolean(),
    isCustom: z.boolean(),
    customTitle: z.string().max(40, 'עד 40 תווים'),
    customStart: z.string(),
    customEnd: z.string(),
    wantDates: z.array(z.string()).max(14, 'אפשר לבחור עד 14 תאריכים'),
    wantPeriodIds: z.array(z.string()),
    wantPositionIds: z.array(z.string()),
    wantOptionOk: z.boolean(),
    note: z.string().max(280, 'עד 280 תווים'),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'seek') {
      if (!isISODate(v.shiftDate)) ctx.addIssue({ code: 'custom', path: ['shiftDate'], message: 'יש לבחור תאריך' });
      if (!v.periodId) ctx.addIssue({ code: 'custom', path: ['periodId'], message: 'יש לבחור משמרת' });
      if (!v.positionId) ctx.addIssue({ code: 'custom', path: ['positionId'], message: 'יש לבחור עמדה' });
      if (v.isCustom) {
        if (v.customTitle.trim().length < 2) ctx.addIssue({ code: 'custom', path: ['customTitle'], message: 'יש לתת שם למשמרת' });
        const hasStart = v.customStart !== '';
        const hasEnd = v.customEnd !== '';
        if (hasStart !== hasEnd) ctx.addIssue({ code: 'custom', path: ['customEnd'], message: 'יש למלא גם שעת התחלה וגם שעת סיום' });
        if (hasStart && !time.safeParse(v.customStart).success) ctx.addIssue({ code: 'custom', path: ['customStart'], message: 'שעה לא תקינה' });
        if (hasEnd && !time.safeParse(v.customEnd).success) ctx.addIssue({ code: 'custom', path: ['customEnd'], message: 'שעה לא תקינה' });
      }
    }
    if (v.type !== 'offer') {
      if (v.wantDates.length === 0) ctx.addIssue({ code: 'custom', path: ['wantDates'], message: 'יש לבחור לפחות תאריך אחד' });
      if (v.wantDates.some((d) => !isISODate(d))) ctx.addIssue({ code: 'custom', path: ['wantDates'], message: 'תאריך לא תקין' });
    }
  });

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export const emailSchema = z.string().trim().email('כתובת מייל לא תקינה').max(254);
