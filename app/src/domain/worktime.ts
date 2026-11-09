import { addDays, minutesOf, weekdayOf } from './dates';
import { newId } from './records';
import type { OvertimeEntry, Settings, WorkSchedule, Workspace } from './types';

export const DEFAULT_SCHEDULE: WorkSchedule = { days: [0, 1, 2, 3, 4], start: '07:00', end: '15:00' };

export const scheduleOf = (settings: Settings): WorkSchedule => settings.workSchedule ?? DEFAULT_SCHEDULE;

export const isWorkDay = (settings: Settings, date: string) => scheduleOf(settings).days.includes(weekdayOf(date));

/** داخل الدوام: يوم عمل وبين وقت البداية والنهاية. */
export function isWorkTime(settings: Settings, date: string, time: string): boolean {
  const schedule = scheduleOf(settings);
  if (!schedule.days.includes(weekdayOf(date))) return false;
  const minute = minutesOf(time);
  return minute >= minutesOf(schedule.start) && minute < minutesOf(schedule.end);
}

/** مدة الفترة بالدقائق (إذا النهاية قبل البداية تمتد لليوم التالي). */
export function durationMinutes(start: string, end: string): number {
  const diff = minutesOf(end) - minutesOf(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return rest + ' دقيقة';
  return hours + (hours === 1 ? ' ساعة' : ' ساعات') + (rest ? ' و' + rest + ' دقيقة' : '');
}

export function saveOvertime(ws: Workspace, input: Omit<OvertimeEntry, 'id' | 'createdAt'>, id?: string, stamp = new Date().toISOString()): Workspace {
  if (!input.reason.trim()) throw new Error('اكتب سبب العمل خارج الدوام');
  if (input.start === input.end) throw new Error('وقت البداية والنهاية متساويين');
  const list = ws.overtime ?? [];
  const existing = id ? list.find((item) => item.id === id) : undefined;
  const entry: OvertimeEntry = { ...input, reason: input.reason.trim(), id: existing?.id ?? newId('ot'), createdAt: existing?.createdAt ?? stamp };
  return { ...ws, overtime: existing ? list.map((item) => (item.id === entry.id ? entry : item)) : [...list, entry] };
}

export const deleteOvertime = (ws: Workspace, id: string): Workspace => ({ ...ws, overtime: (ws.overtime ?? []).filter((item) => item.id !== id) });

export type OvertimeSummary = {
  /** مرات العمل المسجلة خارج الدوام */
  entries: number;
  minutes: number;
  /** زيارات وحضور اجتماعات انسجلت أوقاتها خارج الدوام */
  outOfHoursActivities: number;
  /** أيام مختلفة فيها عمل خارج الدوام (مسجل أو من النشاط) */
  days: number;
};

/** ملخص العمل خارج الدوام في فترة [start, end). */
export function overtimeSummary(ws: Workspace, start: string, end: string): OvertimeSummary {
  const inRange = (date: string) => date >= start && date < end;
  const entries = (ws.overtime ?? []).filter((item) => inRange(item.date));
  const activities = [
    ...ws.visits.filter((v) => !v.seed).map((v) => ({ date: v.date, time: v.time })),
    ...ws.attendance.filter((a) => !a.seed && a.time).map((a) => ({ date: a.date, time: a.time! })),
  ].filter((item) => inRange(item.date) && !isWorkTime(ws.settings, item.date, item.time));
  const days = new Set([...entries.map((e) => e.date), ...activities.map((a) => a.date)]);
  return {
    entries: entries.length,
    minutes: entries.reduce((sum, item) => sum + durationMinutes(item.start, item.end), 0),
    outOfHoursActivities: activities.length,
    days: days.size,
  };
}

/** آخر يوم عمل قبل التاريخ (لحساب السلاسل بدون ما تنكسر بالإجازات). */
export function previousWorkDay(settings: Settings, date: string): string {
  let day = addDays(date, -1);
  for (let i = 0; i < 7 && !isWorkDay(settings, day); i++) day = addDays(day, -1);
  return day;
}
