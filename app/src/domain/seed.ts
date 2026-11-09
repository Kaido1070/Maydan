import { addDays } from './dates';
import type { Department, MeetingAttendance, PlanItem, Settings, Technician, Visit, Workspace } from './types';

export const DEFAULT_SETTINGS: Settings = {
  engineerName: '',
  dailyVisitGoal: 3,
  visitTarget: 2,
  visitWindowMonths: 6,
  xpVisit: 30,
  xpMeeting: 20,
};

/** هيكل الأقسام الافتراضي. الأوقات وبداية الدورات قابلة للتعديل من الإعدادات. */
export function defaultDepartments(anchorDate: string): Department[] {
  const office = (id: string, name: string, shiftName: string): Department => ({
    id,
    name,
    shifts: [{ id: id + '-A', name: shiftName }],
    periods: [{ id: 'admin', name: 'دوام', start: '07:00', end: '15:00' }],
    rotation: { kind: 'weekly', workDays: [0, 1, 2, 3, 4] },
  });
  return [
    {
      id: 'a',
      name: 'عدادات',
      shifts: [
        { id: 'a-A', name: 'عدادات أ' },
        { id: 'a-B', name: 'عدادات ب' },
      ],
      periods: [{ id: 'day', name: 'صباحي', start: '07:00', end: '19:00' }],
      rotation: { kind: 'cycle', anchorDate, pattern: ['day', 'day', 'day', 'day', 'off', 'off', 'off', 'off'], staggerDays: 4 },
    },
    {
      id: 'b',
      name: 'طوارئ',
      shifts: [
        { id: 'b-A', name: 'طوارئ أ' },
        { id: 'b-B', name: 'طوارئ ب' },
        { id: 'b-C', name: 'طوارئ ج' },
        { id: 'b-D', name: 'طوارئ د' },
      ],
      periods: [
        { id: 'day', name: 'صباحي', start: '07:00', end: '19:00' },
        { id: 'night', name: 'مسائي', start: '19:00', end: '07:00' },
      ],
      rotation: { kind: 'cycle', anchorDate, pattern: ['day', 'day', 'night', 'night', 'off', 'off', 'off', 'off'], staggerDays: 2 },
    },
    office('c', 'مساح', 'المسح الميداني'),
    office('d', 'صيانة', 'الصيانة الميدانية'),
    { ...office('e', 'الإنشاءات', 'الإنشاءات الميدانية'), entryKind: 'project' },
    office('f', 'التشغيل', 'التشغيل'),
  ];
}

export function emptyWorkspace(today: string): Workspace {
  return {
    departments: defaultDepartments(today),
    technicians: [],
    meetings: [],
    plan: [],
    settings: { ...DEFAULT_SETTINGS },
    overrides: {},
    visits: [],
    attendance: [],
  };
}

/* ───────────── بيانات وضع التجربة (أسماء وأرقام تجريبية) ───────────── */

const DEMO_CREW: Record<string, string[][]> = {
  'a-A': [['a1', 'أحمد عيسى'], ['a2', 'عبدالله حسن'], ['a3', 'محمد علي'], ['a6', 'فيصل عمر المرواني'], ['a7', 'عبدالعزيز جابر'], ['a8', 'ريان عبدالله حكمي']],
  'a-B': [['a4', 'عبدالرحمن يحيى'], ['a5', 'فهد حسن'], ['a9', 'ماجد سالم'], ['a10', 'نايف أحمد الشهري'], ['a11', 'أسامة عبدالرحمن'], ['a12', 'سلمان محمد عقيلي']],
  'b-A': [['b1', 'حسن يحيى'], ['b2', 'علي إبراهيم'], ['b3', 'خالد محمد'], ['b10', 'عمار سالم مدخلي'], ['b11', 'وليد علي']],
  'b-B': [['b4', 'موسى حسن'], ['b5', 'سعد علي'], ['b12', 'زياد عبدالله'], ['b13', 'حمزة محمد قيسي'], ['b14', 'نواف حسن']],
  'b-C': [['b6', 'بدر محمد'], ['b7', 'ناصر يحيى'], ['b15', 'فارس أحمد'], ['b16', 'هادي منصور'], ['b17', 'حسين عبدالله فقيهي']],
  'b-D': [['b8', 'عمر حسين'], ['b9', 'ياسر أحمد'], ['b18', 'راكان إبراهيم'], ['b19', 'طارق يحيى حمدي'], ['b20', 'منصور سالم']],
  'c-A': [['c1', 'إبراهيم أحمد'], ['c2', 'يحيى سالم'], ['c3', 'مهند علي'], ['c4', 'مالك محمد هزازي'], ['c5', 'صالح أحمد'], ['c6', 'عماد عبدالرحمن']],
  'd-A': [['d1', 'سالم حسين'], ['d2', 'عبدالله علي'], ['d3', 'محمد عبداللطيف صميلي'], ['d4', 'سامي حسن'], ['d5', 'أنس إبراهيم'], ['d6', 'معاذ يحيى جابري'], ['d7', 'حمد محمد']],
  'f-A': [['f1', 'سعود محمد'], ['f2', 'عبدالمجيد علي'], ['f3', 'هاني أحمد'], ['f4', 'ثامر سالم'], ['f5', 'خليل يحيى']],
  'e-A': [['e1', 'مشروع شبكة حي الروضة'], ['e2', 'مشروع محطة التحويل الشمالية'], ['e3', 'مشروع تمديد كابلات الطريق الدائري'], ['e4', 'مشروع إنارة المخطط الصناعي'], ['e5', 'مشروع توسعة محطة الجنوب'], ['e6', 'مشروع شبكة حي النخيل']],
};

/** أيام الزيارات السابقة لكل فني (بالأيام قبل اليوم). */
const DEMO_VISITS: Record<string, number[]> = {
  a1: [-40, -88], a2: [-55], a4: [-40], a5: [-52, -84], a6: [-14, -92], a8: [-67], a9: [-22, -103], a10: [-71], a12: [-34],
  b2: [-13, -105], b3: [-67], b4: [-20], b5: [-65], b6: [-31, -61], b8: [-75], b9: [-21, -50], b10: [-42], b11: [-28, -90],
  b12: [-9, -69], b14: [-34, -109], b15: [-58], b16: [-31, -102], b17: [-28], b18: [-46], b20: [-24, -115],
  c1: [-48], c2: [-21, -69], c4: [-17, -88], c5: [-52],
  d1: [-70], d2: [-41, -89], d4: [-37, -91], d5: [-22], d6: [-13, -55], d7: [-48],
  e1: [-19, -64], e2: [-44], e4: [-40, -85], e5: [-27],
};

/** الاجتماعات التي حضرها كل فني (فهرس اجتماع الربع). */
const DEMO_MEETINGS: Record<string, number[]> = {
  a1: [0, 1, 2], a2: [0, 1], a4: [0], a5: [0, 1], a6: [2], a7: [0, 1, 2], a9: [0, 1, 2], a10: [1, 2], a12: [0],
  b1: [1], b2: [0, 1, 2], b3: [0], b4: [0, 1], b6: [0, 1, 2], b7: [0], b8: [2], b10: [0, 2],
  b12: [0, 1, 2], b13: [2], b15: [0, 2], b17: [0, 1, 2], b19: [0, 1, 2], b20: [1],
  c1: [0, 1], c2: [0, 1, 2], c3: [2], c5: [0, 2], c6: [0, 1, 2],
  d2: [0], d3: [2], d4: [0, 1, 2], d6: [0, 1, 2], d7: [1, 2],
  e1: [0, 1, 2], e2: [0], e4: [0, 2], e6: [1],
};

const DEMO_SITES = ['متابعة موقع تمديد الكابلات', 'فحص معدات الوقاية', 'جولة على أعمال التوزيع', 'زيارة موقع الصيانة الوقائية', 'متابعة أعمال التوصيلات'];

const DEMO_PLAN: [number, string, string, string, 'visit' | 'meeting'][] = [
  [0, 'a', '08:30', 'فحص معدات الوقاية', 'visit'], [0, 'c', '10:15', 'متابعة أعمال الصيانة', 'visit'], [0, 'b', '12:00', 'زيارة موقع أعمال التوزيع', 'visit'],
  [1, 'a', '08:00', 'زيارة ميدانية لأعمال الصيانة', 'visit'], [1, 'b', '09:30', 'زيارة موقع تمديد الكابلات', 'visit'], [1, 'd', '11:00', 'زيارة فحص معدات الوقاية', 'visit'], [1, 'a', '13:00', 'اجتماع الربع الثالث', 'meeting'],
  [2, 'b', '08:00', 'متابعة أعمال التوصيلات', 'visit'], [2, 'a', '10:00', 'زيارة موقع أعمال الطوارئ', 'visit'], [2, 'c', '11:30', 'زيارة موقع أعمال التوصيلات', 'visit'], [2, 'd', '13:00', 'اجتماع الربع الثالث', 'meeting'],
  [3, 'c', '08:30', 'جولة ميدانية على أعمال الصيانة', 'visit'], [3, 'a', '10:30', 'متابعة موقع تمديد الكابلات', 'visit'], [3, 'b', '11:30', 'جولة على موقع أعمال التوزيع', 'visit'], [3, 'b', '19:30', 'اجتماع الربع الثالث', 'meeting'],
  [4, 'b', '08:00', 'زيارة ميدانية لأعمال التوصيلات', 'visit'], [4, 'c', '09:30', 'متابعة أعمال التوزيع', 'visit'], [4, 'a', '11:00', 'زيارة موقع الصيانة الوقائية', 'visit'], [4, 'e', '12:15', 'زيارة موقع أعمال الإنشاءات', 'visit'],
];

export const DEMO_ANCHOR = '2026-11-09';

const DEMO_CONTRACTORS = ['مؤسسة البناء التجريبية', 'شركة الإنشاء التجريبية', 'مقاول تجريبي'];

export const demoEmployeeNumber = (id: string) => String(1100 + (id.charCodeAt(0) - 97) * 100 + Number(id.slice(1)));

export function demoWorkspace(today: string): Workspace {
  const departments = defaultDepartments(DEMO_ANCHOR).map((department) =>
    department.rotation.kind === 'weekly'
      ? { ...department, periods: department.periods.map((period) => ({ ...period, name: 'دوام تجريبي' })) }
      : department,
  );
  const technicians: Technician[] = Object.entries(DEMO_CREW).flatMap(([shiftId, crew]) =>
    crew.map(([id, name]) =>
      shiftId[0] === 'e'
        ? { id, name, employeeNumber: 'P-' + demoEmployeeNumber(id), kind: 'project' as const, contractor: DEMO_CONTRACTORS[Number(id.slice(1)) % DEMO_CONTRACTORS.length], departmentId: 'e', baseShiftId: shiftId }
        : { id, name, employeeNumber: demoEmployeeNumber(id), departmentId: shiftId[0], baseShiftId: shiftId },
    ),
  );
  const stamp = today + 'T09:00:00.000Z';

  // الفنيون في نفس القسم ونفس اليوم يجمعهم سجل زيارة واحد (زيارة جماعية).
  const grouped = new Map<string, string[]>();
  for (const [id, offsets] of Object.entries(DEMO_VISITS)) {
    for (const offset of offsets) {
      const key = id[0] + '|' + offset;
      grouped.set(key, [...(grouped.get(key) ?? []), id]);
    }
  }
  const visits: Visit[] = [...grouped.entries()].map(([key, people], index) => {
    const [departmentId, offset] = key.split('|');
    return {
      id: 'demo-v' + index,
      departmentId,
      date: addDays(today, Number(offset)),
      time: ['08:30', '10:00', '11:30', '13:00'][index % 4],
      site: DEMO_SITES[index % DEMO_SITES.length],
      technicianIds: people,
      seed: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  const year = Number(today.slice(0, 4));
  const meetings = ['الأول', 'الثاني', 'الثالث'].map((label, index) => ({ id: 'demo-m' + index, title: 'اجتماع الربع ' + label, year }));
  const attendance: MeetingAttendance[] = [];
  for (const department of departments) {
    meetings.forEach((meeting, index) => {
      const people = technicians
        .filter((tech) => tech.departmentId === department.id && DEMO_MEETINGS[tech.id]?.includes(index))
        .map((tech) => tech.id);
      const planned = `${year}-${String(index * 3 + 2).padStart(2, '0')}-15`;
      if (people.length)
        attendance.push({
          id: 'demo-a' + department.id + index,
          meetingId: meeting.id,
          departmentId: department.id,
          date: planned <= today ? planned : today,
          technicianIds: people,
          seed: true,
          updatedAt: stamp,
        });
    });
  }

  const plan: PlanItem[] = DEMO_PLAN.map(([weekday, departmentId, time, title, kind], index) => ({
    id: 'demo-p' + index,
    weekday,
    departmentId,
    time,
    title,
    kind,
    ...(kind === 'meeting' ? { meetingId: 'demo-m2' } : {}),
  }));

  const places = [
    { id: 'demo-pl1', kind: 'warehouse' as const, name: 'المستودع الرئيسي (تجريبي)' },
    { id: 'demo-pl2', kind: 'warehouse' as const, name: 'مستودع الصيانة (تجريبي)' },
    { id: 'demo-pl3', kind: 'staging' as const, name: 'نقطة انطلاق الطوارئ (تجريبي)' },
    { id: 'demo-pl4', kind: 'staging' as const, name: 'نقطة انطلاق العدادات (تجريبي)' },
  ];

  return {
    departments,
    technicians,
    meetings,
    places,
    plan,
    settings: { ...DEFAULT_SETTINGS, engineerName: 'مهدي' },
    overrides: {},
    visits,
    attendance,
  };
}
