import { addVisit } from '../records';
import { demoWorkspace, emptyWorkspace } from '../seed';
import { visitPlan } from '../visitPlan';

const MONDAY = { date: '2026-11-09', time: '08:00' };

describe('خطة الزيارات المقترحة', () => {
  test('حتى 3 زيارات في اليوم، بدون تكرار فني، وأيام الدوام فقط', () => {
    const plan = visitPlan(demoWorkspace('2026-11-09'), MONDAY);
    expect(plan.map((d) => d.date)).toEqual(expect.arrayContaining(['2026-11-09']));
    for (const day of plan) {
      expect(day.visits.length).toBeLessThanOrEqual(3);
      expect(['2026-11-13', '2026-11-14']).not.toContain(day.date); // الجمعة والسبت
    }
    const ids = plan.flatMap((d) => d.visits.flatMap((v) => v.technicians.map((t) => t.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('اللي بدون زيارة أولًا، والمكتمل ما يدخل الخطة، وشفت الليل ما يُقترح وقت الدوام', () => {
    let ws = emptyWorkspace('2026-11-09');
    ws.technicians = [
      { id: 'zero', name: 'بدون', employeeNumber: '1', departmentId: 'c', baseShiftId: 'c-A' },
      { id: 'one', name: 'وحدة', employeeNumber: '2', departmentId: 'c', baseShiftId: 'c-A' },
      { id: 'done', name: 'مكتمل', employeeNumber: '3', departmentId: 'c', baseShiftId: 'c-A' },
      { id: 'night', name: 'ليلي', employeeNumber: '4', departmentId: 'b', baseShiftId: 'b-B' },
    ];
    ws = addVisit(ws, { departmentId: 'c', date: '2026-10-01', time: '09:00', site: 'س', technicianIds: ['one', 'done'] }, MONDAY.date).ws;
    ws = addVisit(ws, { departmentId: 'c', date: '2026-10-02', time: '09:00', site: 'س', technicianIds: ['done'] }, MONDAY.date).ws;
    const today = visitPlan(ws, MONDAY)[0];
    expect(today.date).toBe(MONDAY.date);
    const mass = today.visits.find((v) => v.department.id === 'c')!;
    expect(mass.technicians.map((t) => t.id)).toEqual(['zero', 'one']);
    expect(mass.withoutVisit).toBe(1);
    // طوارئ ب هذا الأسبوع: مسائي الإثنين والثلاثاء ثم إجازة، والمسائي (19:00–07:00) ما يتقاطع مع دوامك 7–15
    expect(visitPlan(ws, MONDAY).flatMap((d) => d.visits).some((v) => v.technicians.some((t) => t.id === 'night'))).toBe(false);
  });

  test('بعد نهاية الدوام تبدأ الخطة من بكرة', () => {
    const plan = visitPlan(demoWorkspace('2026-11-09'), { date: '2026-11-09', time: '16:00' });
    expect(plan[0]?.date).toBe('2026-11-10');
  });
});
