import { addVisit } from '../records';
import { emptyWorkspace } from '../seed';
import { dayProgress, visitStreak, weekProgress } from '../stats';
import type { Workspace } from '../types';

const TODAY = '2026-11-09'; // الإثنين
function withVisits(days: Record<string, number>, today = TODAY): Workspace {
  let ws = emptyWorkspace(TODAY);
  ws.technicians = [{ id: 't', name: 'فني', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' }];
  for (const [date, count] of Object.entries(days))
    for (let i = 0; i < count; i++) ws = addVisit(ws, { departmentId: 'b', date, time: '09:00', site: 'س', technicianIds: ['t'] }, today).ws;
  return ws;
}

describe('سلسلة الإنجاز على أيام الدوام (الأحد–الخميس)', () => {
  test('الجمعة والسبت ما يكسرون السلسلة، واليوم ما يكسرها قبل ما يخلص', () => {
    // الأربعاء 4، الخميس 5، (جمعة وسبت إجازة)، الأحد 8، واليوم الإثنين زيارة وحدة
    const ws = withVisits({ '2026-11-04': 3, '2026-11-05': 4, '2026-11-08': 3, '2026-11-09': 1 });
    expect(visitStreak(ws, TODAY)).toEqual({ days: 3, todayDone: false });
  });
  test('لما يتحقق هدف اليوم ينضاف، ويوم دوام ناقص يقطع السلسلة', () => {
    const ws = withVisits({ '2026-11-04': 3, '2026-11-05': 2, '2026-11-08': 3, '2026-11-09': 3 });
    expect(visitStreak(ws, TODAY)).toEqual({ days: 2, todayDone: true });
  });
  test('بيانات التجربة الأولية ما تُحسب', () => {
    const ws = withVisits({ '2026-11-08': 3 });
    ws.visits = ws.visits.map((v) => ({ ...v, seed: true }));
    expect(visitStreak(ws, TODAY).days).toBe(0);
  });
  test('هدف اليوم صفر في الإجازة، وهدف الأسبوع = اليومي × أيام الدوام', () => {
    const ws = withVisits({});
    expect(dayProgress(ws, '2026-11-13')).toMatchObject({ goal: 0, workDay: false }); // جمعة
    expect(dayProgress(ws, TODAY)).toMatchObject({ goal: 3, workDay: true });
    expect(weekProgress(ws, TODAY).goal).toBe(15);
    ws.settings.workSchedule = { days: [0, 1, 2, 3], start: '07:00', end: '15:00' };
    expect(weekProgress(ws, TODAY).goal).toBe(12);
  });
});
