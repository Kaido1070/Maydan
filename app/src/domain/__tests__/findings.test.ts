import { addFindingUpdate, findingAge, findingStats, findingsOf, isOverdue, lastDelayReason, saveFinding } from '../findings';
import { addMeeting, addVisit, saveAttendanceBatch } from '../records';
import { emptyWorkspace } from '../seed';
import { durationMinutes, formatDuration, isWorkTime, overtimeSummary, saveOvertime } from '../worktime';

const TODAY = '2026-11-12';
const base = { kind: 'observation' as const, description: '', location: 'موقع', responsible: 'مقاول', photos: [] };

describe('متابعة الملاحظات', () => {
  test('كم لها، ومتأخرة، وسبب التأخير، والإغلاق', () => {
    let ws = emptyWorkspace('2026-11-09');
    const created = saveFinding(ws, { ...base, title: 'غطاء غرفة مفتوح', date: '2026-11-02', dueDate: '2026-11-05' });
    ws = created.ws;
    const id = created.finding.id;
    expect(findingAge(created.finding, TODAY)).toBe(10);
    expect(isOverdue(created.finding, TODAY)).toBe(true);
    ws = addFindingUpdate(ws, id, { date: '2026-11-06', kind: 'delay', text: 'بانتظار قطع غيار من المقاول' });
    expect(ws.findings![0].status).toBe('progress');
    expect(lastDelayReason(ws.findings![0])).toBe('بانتظار قطع غيار من المقاول');
    expect(() => addFindingUpdate(ws, id, { date: TODAY, kind: 'delay', text: ' ' })).toThrow('سبب التأخير');
    ws = addFindingUpdate(ws, id, { date: '2026-11-09', kind: 'close', text: 'تم التركيب' });
    const closed = ws.findings![0];
    expect(closed).toMatchObject({ status: 'closed', closedAt: '2026-11-09' });
    expect(findingAge(closed, TODAY)).toBe(7); // من 2 إلى 9 نوفمبر
    expect(isOverdue(closed, TODAY)).toBe(false);
  });

  test('الترتيب والإحصاءات: المتأخر أولًا، ومتوسط أيام الإغلاق', () => {
    let ws = emptyWorkspace('2026-11-09');
    ws = saveFinding(ws, { ...base, title: 'جديدة', date: '2026-11-11' }).ws;
    ws = saveFinding(ws, { ...base, title: 'متأخرة', date: '2026-11-08', dueDate: '2026-11-10' }).ws;
    const done = saveFinding(ws, { ...base, title: 'مقفلة', date: '2026-11-01' });
    ws = addFindingUpdate(done.ws, done.finding.id, { date: '2026-11-05', kind: 'close', text: '' });
    ws = saveFinding(ws, { ...base, kind: 'violation', title: 'مخالفة', date: '2026-11-10' }).ws;
    expect(findingsOf(ws, 'observation', TODAY).map((f) => f.title)).toEqual(['متأخرة', 'جديدة', 'مقفلة']);
    expect(findingStats(ws, 'observation', TODAY)).toEqual({ open: 2, overdue: 1, closed: 1, avgDaysToClose: 4, oldestOpenDays: 4 });
    expect(findingStats(ws, 'violation', TODAY).open).toBe(1);
  });
});

describe('العمل خارج الدوام', () => {
  test('حدود الدوام: الأحد–الخميس 7:00–15:00', () => {
    const s = emptyWorkspace('2026-11-09').settings;
    expect(isWorkTime(s, '2026-11-09', '07:00')).toBe(true);
    expect(isWorkTime(s, '2026-11-09', '15:00')).toBe(false);
    expect(isWorkTime(s, '2026-11-13', '10:00')).toBe(false); // جمعة
  });

  test('المدة، والملخص من السجل ومن أوقات الزيارات والاجتماعات', () => {
    expect(durationMinutes('22:00', '01:30')).toBe(210);
    expect(formatDuration(210)).toBe('3 ساعات و30 دقيقة');
    let ws = emptyWorkspace('2026-11-09');
    ws.technicians = [{ id: 't', name: 'فني', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' }];
    ws = saveOvertime(ws, { date: '2026-11-10', start: '18:00', end: '20:30', reason: 'بلاغ طوارئ' });
    expect(() => saveOvertime(ws, { date: '2026-11-10', start: '18:00', end: '19:00', reason: '' })).toThrow('سبب');
    ws = addVisit(ws, { departmentId: 'b', date: '2026-11-10', time: '19:00', site: 'ليلية', technicianIds: ['t'] }, TODAY).ws;
    ws = addVisit(ws, { departmentId: 'b', date: '2026-11-10', time: '09:00', site: 'صباحية', technicianIds: ['t'] }, TODAY).ws;
    ws = addVisit(ws, { departmentId: 'b', date: '2026-11-07', time: '09:00', site: 'سبت', technicianIds: ['t'] }, TODAY).ws;
    const m = addMeeting(ws, 'اجتماع', 2026);
    ws = saveAttendanceBatch(m.ws, { departmentId: 'b', date: '2026-11-11', time: '16:00', entries: { [m.meeting.id]: ['t'] } }).ws;
    expect(overtimeSummary(ws, '2026-11-01', '2026-12-01')).toEqual({ entries: 1, minutes: 150, outOfHoursActivities: 3, days: 3 });
  });
});
