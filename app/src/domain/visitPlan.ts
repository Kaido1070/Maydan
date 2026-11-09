import { addDays, minutesOf, weekdayOf } from './dates';
import { activeTechnicians, getSlot, isOvernight } from './shifts';
import { technicianVisits } from './stats';
import type { Department, Now, PeriodDef, Technician, Workspace } from './types';
import { isWorkDay, scheduleOf } from './worktime';

export type PlannedVisit = {
  date: string;
  department: Department;
  shiftName: string;
  period: PeriodDef;
  technicians: Technician[];
  /** كم واحد منهم بدون أي زيارة. */
  withoutVisit: number;
};

export type DayPlan = { date: string; visits: PlannedVisit[] };

const MAX_PER_VISIT = 6;

/** هل الفترة تتقاطع مع دوام المهندس (يعني يقدر يزورهم وقت دوامه)؟ */
function overlapsWorkHours(period: PeriodDef, start: string, end: string): boolean {
  const [ws, we] = [minutesOf(start), minutesOf(end)];
  const ranges: [number, number][] = isOvernight(period)
    ? [
        [minutesOf(period.start), 24 * 60],
        [0, minutesOf(period.end)],
      ]
    : [[minutesOf(period.start), minutesOf(period.end)]];
  return ranges.some(([a, b]) => a < we && b > ws);
}

/**
 * خطة زيارات مقترحة لباقي أيام الدوام في هذا الأسبوع (من اليوم لين السبت).
 * لكل يوم: حتى «هدف الزيارات اليومي» زيارة، كل زيارة = فنيو قسم/شفت يداومون وقت دوامك
 * وناقصهم زيارات (اللي بدون زيارة أولًا، ثم الأقدم زيارة). الفني ما يتكرر في أكثر من يوم.
 */
export function visitPlan(ws: Workspace, now: Now): DayPlan[] {
  const schedule = scheduleOf(ws.settings);
  const target = ws.settings.visitTarget;
  const perDay = ws.settings.dailyVisitGoal;
  const active = new Set(activeTechnicians(ws).map((tech) => tech.id));
  const planned = new Set<string>();
  const count = new Map<string, { visits: number; last: string }>();
  const need = (tech: Technician) => {
    if (!count.has(tech.id)) {
      const visits = technicianVisits(ws, tech.id, now.date);
      count.set(tech.id, { visits: visits.length, last: visits[0]?.date ?? '' });
    }
    return count.get(tech.id)!;
  };

  const days: DayPlan[] = [];
  const lastDay = addDays(now.date, 6 - weekdayOf(now.date)); // السبت
  for (let date = now.date; date <= lastDay; date = addDays(date, 1)) {
    if (!isWorkDay(ws.settings, date)) continue;
    // اليوم بعد نهاية الدوام: ما نقترح له شي
    if (date === now.date && minutesOf(now.time) >= minutesOf(schedule.end)) continue;
    const groups: PlannedVisit[] = [];
    for (const department of ws.departments) {
      for (const period of department.periods) {
        if (!overlapsWorkHours(period, schedule.start, schedule.end)) continue;
        const slot = getSlot(ws, department, date, period.id);
        if (!slot.shift) continue;
        const technicians = slot.crew
          .filter((tech) => active.has(tech.id) && !planned.has(tech.id) && need(tech).visits < target)
          .sort((a, b) => need(a).visits - need(b).visits || need(a).last.localeCompare(need(b).last) || a.name.localeCompare(b.name, 'ar'))
          .slice(0, MAX_PER_VISIT);
        if (technicians.length)
          groups.push({
            date,
            department,
            shiftName: slot.shift.name,
            period,
            technicians,
            withoutVisit: technicians.filter((tech) => need(tech).visits === 0).length,
          });
      }
    }
    groups.sort((a, b) => b.withoutVisit - a.withoutVisit || b.technicians.length - a.technicians.length);
    const visits = groups.slice(0, perDay);
    for (const visit of visits) for (const tech of visit.technicians) planned.add(tech.id);
    if (visits.length) days.push({ date, visits });
  }
  return days;
}
