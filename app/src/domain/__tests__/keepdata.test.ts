import { saveFinding } from '../findings';
import { addMeeting, addVisit } from '../records';
import { demoWorkspace, emptyWorkspace } from '../seed';
import { addPlace } from '../places';
import { saveOvertime } from '../worktime';
import type { AppState, Workspace } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadState } = require('../../store');

/** بيانات عمل كاملة مثل اللي يدخلها المستخدم بنفسه. */
function userData(): Workspace {
  let ws = emptyWorkspace('2026-11-01');
  const [a, b] = ws.departments;
  ws = {
    ...ws,
    departments: [...ws.departments, { ...b, id: 'custom', name: 'قسم أضفته بنفسي', shifts: [{ id: 'custom-A', name: 'شفت خاص' }] }],
    technicians: [
      { id: 't1', name: 'فني من الإكسل', employeeNumber: '9001', departmentId: a.id, baseShiftId: a.shifts[0].id },
      { id: 't2', name: 'مشروع خاص', employeeNumber: '', kind: 'project', contractor: 'مقاول', departmentId: 'custom', baseShiftId: 'custom-A', workplace: 'field' },
      { id: 't3', name: 'موظف مكتبي', employeeNumber: '9003', departmentId: a.id, baseShiftId: a.shifts[0].id, workplace: 'office' },
    ],
    settings: { ...ws.settings, engineerName: 'مهدي', dailyVisitGoal: 4, weeklyVisitGoal: 15 },
  };
  ws = addMeeting(ws, 'عنوان اجتماعي', 2026).ws;
  ws = addVisit(ws, { departmentId: a.id, date: '2026-11-03', time: '09:00', workType: 'فحص', site: 'موقع', technicianIds: ['t1'] }, '2026-11-09').ws;
  ws = addPlace(ws, { kind: 'warehouse', name: 'مستودعي' });
  ws = saveFinding(ws, { kind: 'lsr', title: 'بدون عزل', description: '', location: '', responsible: '', photos: [], date: '2026-11-04', technicianIds: ['t1'], extra: { rule: 'العزل وفصل الطاقة' } }).ws;
  ws = saveOvertime(ws, { date: '2026-11-04', start: '16:00', end: '18:00', reason: 'بلاغ' });
  return ws;
}

describe('التحديث ما يحذف بياناتك', () => {
  test('كل بيانات العمل تبقى كما هي بعد فتح نسخة جديدة', () => {
    const live = userData();
    const saved: AppState = { version: 1, mode: 'live', demo: demoWorkspace('2026-11-09'), live };
    const loaded = loadState(JSON.stringify(saved))!;
    expect(loaded.mode).toBe('live');
    const keys: (keyof Workspace)[] = ['technicians', 'visits', 'meetings', 'attendance', 'findings', 'places', 'overtime', 'settings', 'overrides'];
    for (const key of keys) expect(loaded.live[key]).toEqual(JSON.parse(JSON.stringify(live[key])));
    // الأقسام: القديمة والمضافة كلها موجودة بنفس البيانات (الترقيات تضيف فقط).
    for (const department of live.departments) expect(loaded.live.departments).toContainEqual(department);
    // فتح ثاني ما يغير شي.
    expect(loadState(JSON.stringify(loaded))!.live).toEqual(loaded.live);
  });

  test('بيانات غير مفهومة ما تنمسح ولا تنستبدل', () => {
    expect(loadState('{not json')).toBeNull();
    expect(loadState(JSON.stringify({ version: 2, live: {} }))).toBeNull();
  });
});
