import { addDays, minutesOf, weekdayOf } from './dates';
import { activeTechnicians, getSlot, isOvernight } from './shifts';
import { attendedMeetings, technicianVisits, yearMeetings } from './stats';
import { placeStatus } from './places';
import type { Department, Meeting, Now, PeriodDef, Place, Technician, Workspace } from './types';
import { isWorkDay, scheduleOf } from './worktime';

export type PlannedVisit = {
  kind: 'crew';
  date: string;
  department: Department;
  shiftName: string;
  period: PeriodDef;
  /** فنيون ناقصهم زيارات (قد تكون فاضية إذا الاقتراح اجتماع فقط). */
  technicians: Technician[];
  /** كم واحد منهم بدون أي زيارة. */
  withoutVisit: number;
  /** اجتماع مقترح من عناوينك مع من ما حضره من فريق هذا الشفت. */
  meeting?: { meeting: Meeting; people: Technician[] };
};

export type PlannedPlace = { kind: 'place'; date: string; place: Place; lastVisitDate?: string };

export type PlanItem = PlannedVisit | PlannedPlace;

export type DayPlan = { date: string; visits: PlanItem[] };

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
  const year = Number(now.date.slice(0, 4));
  const meetings = yearMeetings(ws, year);
  const active = new Set(activeTechnicians(ws).map((tech) => tech.id));
  const planned = new Set<string>();
  const plannedMeeting = new Set<string>(); // techId|meetingId
  const count = new Map<string, { visits: number; last: string }>();
  const attended = new Map<string, Set<string>>();
  const need = (tech: Technician) => {
    if (!count.has(tech.id)) {
      const visits = technicianVisits(ws, tech.id, now.date);
      count.set(tech.id, { visits: visits.length, last: visits[0]?.date ?? '' });
    }
    return count.get(tech.id)!;
  };
  const metBy = (tech: Technician) => {
    if (!attended.has(tech.id)) attended.set(tech.id, attendedMeetings(ws, tech.id, year));
    return attended.get(tech.id)!;
  };
  const placesDue = placeStatus(ws, now.date).filter((status) => !status.visitedThisMonth);

  const days: DayPlan[] = [];
  const lastDay = addDays(now.date, 6 - weekdayOf(now.date)); // السبت
  for (let date = now.date; date <= lastDay; date = addDays(date, 1)) {
    if (!isWorkDay(ws.settings, date)) continue;
    // اليوم بعد نهاية الدوام: ما نقترح له شي
    if (date === now.date && minutesOf(now.time) >= minutesOf(schedule.end)) continue;
    const groups: (PlannedVisit & { score: number })[] = [];
    for (const department of ws.departments) {
      for (const period of department.periods) {
        if (!overlapsWorkHours(period, schedule.start, schedule.end)) continue;
        const slot = getSlot(ws, department, date, period.id);
        if (!slot.shift) continue;
        const crew = slot.crew.filter((tech) => active.has(tech.id));
        const technicians = crew
          .filter((tech) => tech.workplace !== 'office' && !planned.has(tech.id) && need(tech).visits < target)
          .sort((a, b) => need(a).visits - need(b).visits || need(a).last.localeCompare(need(b).last) || a.name.localeCompare(b.name, 'ar'))
          .slice(0, MAX_PER_VISIT);
        // الاجتماع اللي أكثر فريق هذا الشفت ما حضره (من عناوينك لهذه السنة)
        let meeting: PlannedVisit['meeting'];
        for (const item of meetings) {
          const people = crew.filter((tech) => !metBy(tech).has(item.id) && !plannedMeeting.has(tech.id + '|' + item.id));
          if (people.length && people.length > (meeting?.people.length ?? 0)) meeting = { meeting: item, people };
        }
        if (!technicians.length && !meeting) continue;
        const withoutVisit = technicians.filter((tech) => need(tech).visits === 0).length;
        groups.push({
          kind: 'crew',
          date,
          department,
          shiftName: slot.shift.name,
          period,
          technicians,
          withoutVisit,
          meeting,
          score: withoutVisit * 3 + technicians.length * 2 + (meeting?.people.length ?? 0),
        });
      }
    }
    groups.sort((a, b) => b.score - a.score);
    const chosen = groups.slice(0, perDay).map(({ score, ...item }) => item);
    for (const visit of chosen) {
      for (const tech of visit.technicians) planned.add(tech.id);
      if (visit.meeting) for (const tech of visit.meeting.people) plannedMeeting.add(tech.id + '|' + visit.meeting.meeting.id);
    }
    const items: PlanItem[] = [...chosen];
    // مستودع أو نقطة انطلاق ما انزار هالشهر: واحد في اليوم
    const place = placesDue.shift();
    if (place) items.push({ kind: 'place', date, place: place.place, lastVisitDate: place.lastVisit?.date });
    if (items.length) days.push({ date, visits: items });
  }
  return days;
}
