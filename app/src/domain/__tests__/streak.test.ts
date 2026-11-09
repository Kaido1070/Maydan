import { addVisit } from '../records';
import { emptyWorkspace } from '../seed';
import { visitStreak } from '../stats';
import type { Workspace } from '../types';

const TODAY = '2026-11-09';
function withVisits(days: Record<string, number>): Workspace {
  let ws = emptyWorkspace(TODAY);
  ws.technicians = [{ id: 't', name: 'فني', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' }];
  for (const [date, count] of Object.entries(days))
    for (let i = 0; i < count; i++) ws = addVisit(ws, { departmentId: 'b', date, time: '09:00', site: 'س', technicianIds: ['t'] }, TODAY).ws;
  return ws;
}

describe('سلسلة الإنجاز', () => {
  test('أيام متتالية حققت هدف 3 زيارات، واليوم ما يكسرها قبل ما يخلص', () => {
    const ws = withVisits({ '2026-11-06': 3, '2026-11-07': 4, '2026-11-08': 3, '2026-11-09': 1 });
    expect(visitStreak(ws, TODAY)).toEqual({ days: 3, todayDone: false });
  });
  test('لما يتحقق هدف اليوم ينضاف للسلسلة، واليوم الناقص يقطعها', () => {
    const ws = withVisits({ '2026-11-06': 3, '2026-11-07': 2, '2026-11-08': 3, '2026-11-09': 3 });
    expect(visitStreak(ws, TODAY)).toEqual({ days: 2, todayDone: true });
  });
  test('بيانات التجربة الأولية ما تُحسب', () => {
    const ws = withVisits({ '2026-11-08': 3 });
    ws.visits = ws.visits.map((v) => ({ ...v, seed: true }));
    expect(visitStreak(ws, TODAY).days).toBe(0);
  });
});
