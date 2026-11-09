import type { Now } from './types';

/** السعودية على UTC+3 طوال السنة (بدون توقيت صيفي)، فنحسب الوقت بدون الاعتماد على Intl. */
export const RIYADH_OFFSET_MINUTES = 180;

export function riyadhNow(now: Date = new Date()): Now {
  const shifted = new Date(now.getTime() + RIYADH_OFFSET_MINUTES * 60000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDateKey = (value: string) =>
  DATE_RE.test(value) && toUTC(value).toISOString().slice(0, 10) === value;
export const isTime = (value: string) => TIME_RE.test(value);

export const toUTC = (key: string) => new Date(key + 'T12:00:00Z');
export const fromUTC = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(key: string, days: number): string {
  const date = toUTC(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86400000);

export const weekdayOf = (key: string) => toUTC(key).getUTCDay();

export function monthsBefore(key: string, months: number): string {
  const date = toUTC(key);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const endOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, endOfMonth));
  return fromUTC(date);
}

export const dateOf = (year: number, month: number, day = 1) =>
  fromUTC(new Date(Date.UTC(year, month, day, 12)));

export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const mod = (value: number, length: number) => ((value % length) + length) % length;

export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function formatDate(key: string, options: { weekday?: boolean; year?: boolean } = {}): string {
  const date = toUTC(key);
  const text = date.getUTCDate() + ' ' + MONTHS_AR[date.getUTCMonth()] + (options.year ? ' ' + date.getUTCFullYear() : '');
  return options.weekday ? WEEKDAYS_AR[date.getUTCDay()] + ' ' + text : text;
}

/** يحوّل الأرقام العربية والفارسية إلى أرقام لاتينية. */
export const normalizeDigits = (value: string) =>
  value.trim().replace(/[٠-٩۰-۹]/g, (char) => String(char.charCodeAt(0) & 15));
