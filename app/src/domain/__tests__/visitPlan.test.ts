import { addPlace, deletePlace, equipmentVisits, quarterOf, renamePlace, warehouseQuarter } from '../places';
import { dayProgress } from '../stats';
import { addMeeting, addVisit, saveAttendanceBatch } from '../records';
import { demoWorkspace, emptyWorkspace } from '../seed';
import { DayPlan, PlannedVisit, visitPlan } from '../visitPlan';

const MONDAY = { date: '2026-11-09', time: '08:00' };
const crews = (day: DayPlan) => day.visits.filter((v): v is PlannedVisit => v.kind === 'crew');

function fixture() {
  let ws = emptyWorkspace('2026-11-09');
  ws.technicians = [
    { id: 'zero', name: 'بدون', employeeNumber: '1', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'one', name: 'وحدة', employeeNumber: '2', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'done', name: 'مكتمل', employeeNumber: '3', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'night', name: 'ليلي', employeeNumber: '4', departmentId: 'b', baseShiftId: 'b-B' },
  ];
  ws = addVisit(ws, { departmentId: 'c', date: '2026-10-01', time: '09:00', site: 'س', technicianIds: ['one', 'done'] }, MONDAY.date).ws;
  ws = addVisit(ws, { departmentId: 'c', date: '2026-10-02', time: '09:00', site: 'س', technicianIds: ['done'] }, MONDAY.date).ws;
  return ws;
}

describe('خطة الزيارات المقترحة', () => {
  test('حتى 3 زيارات فنيين في اليوم، بدون تكرار فني، وأيام الدوام فقط', () => {
    const plan = visitPlan(demoWorkspace('2026-11-09'), MONDAY);
    expect(plan[0].date).toBe('2026-11-09');
    for (const day of plan) {
      expect(crews(day).length).toBeLessThanOrEqual(3);
      expect(['2026-11-13', '2026-11-14']).not.toContain(day.date);
    }
    const ids = plan.flatMap((d) => crews(d).flatMap((v) => v.technicians.map((t) => t.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('اللي بدون زيارة أولًا، والمكتمل ما يدخل، وشفت الليل ما يُقترح وقت الدوام', () => {
    const ws = fixture();
    const mass = crews(visitPlan(ws, MONDAY)[0]).find((v) => v.department.id === 'c')!;
    expect(mass.technicians.map((t) => t.id)).toEqual(['zero', 'one']);
    expect(mass.withoutVisit).toBe(1);
    // طوارئ ب هذا الأسبوع: مسائي الإثنين والثلاثاء ثم إجازة، والمسائي (19:00–07:00) ما يتقاطع مع دوامك 7–15
    expect(visitPlan(ws, MONDAY).flatMap(crews).some((v) => v.technicians.some((t) => t.id === 'night'))).toBe(false);
  });

  test('بعد نهاية الدوام تبدأ الخطة من بكرة', () => {
    expect(visitPlan(demoWorkspace('2026-11-09'), { date: '2026-11-09', time: '16:00' })[0]?.date).toBe('2026-11-10');
  });
});

describe('اجتماع مقترح مع الزيارة', () => {
  test('من عناوينك: الاجتماع اللي أكثر الفريق ما حضره، ومع من بالضبط', () => {
    let ws = fixture();
    const a = addMeeting(ws, 'اجتماع أ', 2026);
    const b = addMeeting(a.ws, 'اجتماع ب', 2026);
    ws = saveAttendanceBatch(b.ws, { departmentId: 'c', date: '2026-11-01', entries: { [a.meeting.id]: ['zero', 'one'], [b.meeting.id]: ['zero'] } }).ws;
    const mass = crews(visitPlan(ws, MONDAY)[0]).find((v) => v.department.id === 'c')!;
    expect(mass.meeting!.meeting.title).toBe('اجتماع ب');
    expect(mass.meeting!.people.map((t) => t.id).sort()).toEqual(['done', 'one']);
  });

  test('فريق مكتمل الزيارات لكن ناقصه اجتماع يطلع في الخطة للاجتماع فقط، وما يتكرر بكرة', () => {
    let ws = emptyWorkspace('2026-11-09');
    ws.technicians = [{ id: 'x', name: 'مكتمل', employeeNumber: '1', departmentId: 'c', baseShiftId: 'c-A' }];
    ws = addVisit(ws, { departmentId: 'c', date: '2026-10-01', time: '09:00', site: 'س', technicianIds: ['x'] }, MONDAY.date).ws;
    ws = addVisit(ws, { departmentId: 'c', date: '2026-10-02', time: '09:00', site: 'س', technicianIds: ['x'] }, MONDAY.date).ws;
    ws = addMeeting(ws, 'اجتماع', 2026).ws;
    const plan = visitPlan(ws, MONDAY);
    const onlyMeeting = crews(plan[0])[0];
    expect(onlyMeeting.technicians).toEqual([]);
    expect(onlyMeeting.meeting!.people.map((t) => t.id)).toEqual(['x']);
    expect(plan.slice(1).flatMap(crews)).toEqual([]);
  });
});

describe('المستودعات ونقاط الانطلاق', () => {
  test('المطلوب مستودعين كل ربع: ينقترحون لين يتحقق الهدف، ونقاط الانطلاق ما تنقترح', () => {
    let ws = emptyWorkspace('2026-11-09');
    for (const name of ['مستودع الشمال', 'مستودع الجنوب', 'مستودع الشرق']) ws = addPlace(ws, { kind: 'warehouse', name });
    ws = addPlace(ws, { kind: 'staging', name: 'نقطة انطلاق الطوارئ' });
    expect(() => addPlace(ws, { kind: 'warehouse', name: 'مستودع الشمال' })).toThrow('موجود');
    const suggested = () => visitPlan(ws, MONDAY).flatMap((d) => d.visits).flatMap((v) => (v.kind === 'place' ? [v.place.name] : []));
    expect(suggested()).toHaveLength(2);
    expect(suggested()).not.toContain('نقطة انطلاق الطوارئ');
    expect(warehouseQuarter(ws, MONDAY.date)).toMatchObject({ goal: 2, visited: 0, remaining: 2, label: 'الربع الرابع', total: 3 });
    const visit = (index: number, date: string) =>
      (ws = addVisit(ws, { departmentId: '', placeId: ws.places![index].id, date, time: '09:00', workType: 'زيارة مستودع', location: ws.places![index].name, site: '', technicianIds: [] }, MONDAY.date).ws);
    visit(0, MONDAY.date);
    visit(0, MONDAY.date); // نفس المستودع مرتين = مستودع واحد
    expect(warehouseQuarter(ws, MONDAY.date)).toMatchObject({ visited: 1, remaining: 1 });
    expect(suggested()).toHaveLength(1);
    expect(suggested()).not.toContain('مستودع الشمال');
    visit(1, '2026-10-05'); // بداية نفس الربع
    expect(warehouseQuarter(ws, MONDAY.date)).toMatchObject({ visited: 2, remaining: 0 });
    expect(suggested()).toEqual([]);
    // الربع الجاي يبدأ من صفر
    expect(warehouseQuarter(ws, '2027-01-04')).toMatchObject({ visited: 0, remaining: 2, label: 'الربع الأول' });
    expect(quarterOf('2026-11-09')).toMatchObject({ start: '2026-10-01', end: '2027-01-01' });
  });

  test('زيارة معدات التوزيع: بدون فنيين ولا قسم، وتنحسب في زيارات اليوم', () => {
    let ws = emptyWorkspace('2026-11-09');
    const base = { departmentId: '', date: MONDAY.date, time: '10:00', site: '', technicianIds: [] as string[] };
    expect(() => addVisit(ws, { ...base, location: 'محول 5' }, MONDAY.date)).toThrow('اختر القسم');
    expect(() => addVisit(ws, { ...base, target: 'equipment', workType: 'زيارة معدات التوزيع' }, MONDAY.date)).toThrow('اكتب اسم المعدة');
    ws = addVisit(ws, { ...base, target: 'equipment', workType: 'زيارة معدات التوزيع', location: 'محطة توزيع 12' }, MONDAY.date).ws;
    expect(equipmentVisits(ws).map((v) => v.location)).toEqual(['محطة توزيع 12']);
    expect(dayProgress(ws, MONDAY.date).visits).toBe(1);
  });
});

describe('تسجيل المستودعات ونقاط الانطلاق', () => {
  test('إضافة وتعديل الاسم والنوع وحذف، بدون تكرار الأسماء', () => {
    let ws = addPlace(emptyWorkspace('2026-11-09'), { kind: 'warehouse', name: ' مستودع  أ ' });
    ws = addPlace(ws, { kind: 'staging', name: 'نقطة ب' });
    const [a, b] = ws.places!;
    expect(a.name).toBe('مستودع أ');
    expect(() => addPlace(ws, { kind: 'staging', name: '' })).toThrow('اكتب اسم ال' + 'نقطة انطلاق');
    ws = renamePlace(ws, a.id, { name: 'مستودع الشمال', kind: 'staging' });
    expect(ws.places![0]).toMatchObject({ name: 'مستودع الشمال', kind: 'staging' });
    expect(() => renamePlace(ws, a.id, { name: 'نقطة ب', kind: 'staging' })).toThrow('موجود');
    ws = deletePlace(ws, b.id);
    expect(ws.places!.map((p) => p.name)).toEqual(['مستودع الشمال']);
  });
});
