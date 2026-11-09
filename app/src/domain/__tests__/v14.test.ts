import { addDepartment } from '../plan';
import { addMeeting, addVisit, saveAttendanceBatch } from '../records';
import { emptyWorkspace } from '../seed';
import { meetingRemaining, weekProgress } from '../stats';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { migrate } = require('../../store');

const TODAY = '2026-11-10'; // الثلاثاء، الأسبوع يبدأ الأحد 8 نوفمبر

function fixture() {
  let ws = emptyWorkspace('2026-11-09');
  ws.technicians = [
    { id: 'a', name: 'أ', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 'b', name: 'ب', employeeNumber: '2', departmentId: 'b', baseShiftId: 'b-B' },
    { id: 'c', name: 'ج', employeeNumber: '3', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'x', name: 'موقوف', employeeNumber: '4', departmentId: 'c', baseShiftId: 'c-A', active: false },
  ];
  return ws;
}

describe('هدف الأسبوع', () => {
  test('يحسب زيارات الأسبوع من الأحد، والهدف الافتراضي 5 × اليومي', () => {
    let ws = fixture();
    for (const date of ['2026-11-07', '2026-11-08', '2026-11-10', '2026-11-10'])
      ws = addVisit(ws, { departmentId: 'b', date, time: '09:00', site: 'س', technicianIds: ['a'] }, TODAY).ws;
    expect(weekProgress(ws, TODAY)).toEqual({ visits: 3, goal: 15, start: '2026-11-08' });
    ws.settings.weeklyVisitGoal = 10;
    expect(weekProgress(ws, TODAY).goal).toBe(10);
  });
});

describe('فلتر الاجتماعات: من باقي عليه اجتماع معيّن', () => {
  test('العدد والأسماء، مع فلتر القسم، بدون الموقوفين', () => {
    let ws = fixture();
    const m = addMeeting(ws, 'اجتماع الربع', 2026);
    ws = saveAttendanceBatch(m.ws, { departmentId: 'b', date: '2026-11-09', entries: { [m.meeting.id]: ['a'] } }).ws;
    const all = meetingRemaining(ws, m.meeting.id);
    expect(all).toMatchObject({ attended: 1, total: 3 });
    expect(all.remaining.map((t) => t.id)).toEqual(['b', 'c']);
    expect(meetingRemaining(ws, m.meeting.id, 'c').remaining.map((t) => t.id)).toEqual(['c']);
  });
});

describe('الأقسام', () => {
  test('إضافة قسم جديد بشفت ودوام افتراضي، وما يتكرر', () => {
    const ws = addDepartment(fixture(), ' السلامة  العامة ');
    const dept = ws.departments[ws.departments.length - 1];
    expect(dept).toMatchObject({ name: 'السلامة العامة', rotation: { kind: 'weekly' } });
    expect(dept.shifts).toHaveLength(1);
    expect(() => addDepartment(ws, 'السلامة العامة')).toThrow('موجود');
  });

  test('قسم التشغيل موجود في البداية، وينضاف للبيانات القديمة بدون ما يمس شي', () => {
    expect(emptyWorkspace('2026-11-09').departments.map((d) => d.name)).toContain('التشغيل');
    const old = emptyWorkspace('2026-11-09');
    old.departments = old.departments.filter((d) => d.name !== 'التشغيل');
    old.technicians = [{ id: 'k', name: 'باقي', employeeNumber: '9', departmentId: 'b', baseShiftId: 'b-A' }];
    const state = migrate({ version: 1, mode: 'live', demo: old, live: old });
    expect(state.live.departments.map((d: { name: string }) => d.name)).toContain('التشغيل');
    expect(state.live.technicians).toEqual(old.technicians);
    expect(state.demo.departments.map((d: { name: string }) => d.name)).toContain('التشغيل');
    // ترقية ثانية ما تكرر القسم
    expect(migrate(state).live.departments.filter((d: { name: string }) => d.name === 'التشغيل')).toHaveLength(1);
  });
});
