import { addDays, riyadhNow } from '../dates';
import { tasksOn } from '../plan';
import { addMeeting, addVisit, deleteVisit, saveAttendanceBatch, updateVisit } from '../records';
import { buildReport, reportCsv } from '../reports';
import { demoWorkspace, emptyWorkspace } from '../seed';
import { assignForDay, crewForShift, currentSlot, getSlot, moveTechnician, setSlotShift, slotAt } from '../shifts';
import { attendedMeetings, followUpList, techProgress, technicianVisits, tone } from '../stats';
import type { Workspace } from '../types';

const TODAY = '2026-11-09'; // الإثنين
const STAMP = '2026-11-09T09:00:00.000Z';

/** مساحة عمل صغيرة ومعروفة الأرقام للاختبار. */
function fixture(): Workspace {
  const ws = emptyWorkspace('2026-11-09');
  ws.settings.engineerName = 'اختبار';
  ws.technicians = [
    { id: 't1', name: 'فني واحد', employeeNumber: '501', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 't2', name: 'فني اثنان', employeeNumber: '502', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 't3', name: 'فني ثلاثة', employeeNumber: '503', departmentId: 'b', baseShiftId: 'b-B' },
    { id: 't4', name: 'فني أربعة', employeeNumber: '504', departmentId: 'c', baseShiftId: 'c-A' },
  ];
  return ws;
}

describe('التوقيت', () => {
  test('توقيت السعودية UTC+3 ويعبر منتصف الليل', () => {
    expect(riyadhNow(new Date('2026-11-09T22:30:00Z'))).toEqual({ date: '2026-11-10', time: '01:30' });
  });
});

describe('الشفتات', () => {
  test('دورة الطوارئ: يومان صباحي، يومان مسائي، 4 أيام راحة', () => {
    const ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    // يوم بداية الدورة: طوارئ أ صباحي يومين ثم مسائي يومين ثم راحة
    expect(getSlot(ws, b, TODAY, 'day').shift?.id).toBe('b-A');
    expect(getSlot(ws, b, addDays(TODAY, 2), 'night').shift?.id).toBe('b-A');
    expect(getSlot(ws, b, addDays(TODAY, 4), 'day').shift?.id).not.toBe('b-A');
    expect(getSlot(ws, b, addDays(TODAY, 8), 'day').shift?.id).toBe('b-A');
  });

  test('المسائي بعد منتصف الليل يتبع شفت اليوم السابق', () => {
    const ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    const night = getSlot(ws, b, TODAY, 'night');
    const early = slotAt(ws, b, addDays(TODAY, 1), '03:00');
    expect(early?.key).toBe(night.key);
    expect(early?.period.id).toBe('night');
  });

  test('الأقسام الأسبوعية لا تعمل الجمعة أو خارج الدوام', () => {
    const ws = fixture();
    const c = ws.departments.find((d) => d.id === 'c')!;
    expect(currentSlot(ws, c, { date: TODAY, time: '09:00' })?.crew.map((t) => t.id)).toEqual(['t4']);
    expect(currentSlot(ws, c, { date: TODAY, time: '16:00' })).toBeNull();
    expect(currentSlot(ws, c, { date: '2026-11-13', time: '09:00' })).toBeNull(); // جمعة
  });

  test('بداية الدورة وأوقات الدوام قابلة للتعديل', () => {
    const ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    b.periods[0] = { ...b.periods[0], start: '06:00', end: '18:00' };
    b.periods[1] = { ...b.periods[1], start: '18:00', end: '06:00' };
    if (b.rotation.kind === 'cycle') b.rotation.anchorDate = addDays(TODAY, -2);
    expect(slotAt(ws, b, TODAY, '06:30')?.period.id).toBe('day');
    // بعد إزاحة البداية يومين، طوارئ أ أصبحت في المسائي اليوم
    expect(getSlot(ws, b, TODAY, 'night').shift?.id).toBe('b-A');
  });

  test('نقل فني بين الشفتات يغيّر شفته الأساسي في الدورة', () => {
    let ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    expect(crewForShift(ws, 'b', 'b-A').map((t) => t.id)).toEqual(['t1', 't2']);
    ws = moveTechnician(ws, 't2', 'b-B');
    expect(ws.technicians.find((t) => t.id === 't2')!.baseShiftId).toBe('b-B');
    expect(crewForShift(ws, 'b', 'b-A').map((t) => t.id)).toEqual(['t1']);
    expect(crewForShift(ws, 'b', 'b-B').map((t) => t.id)).toEqual(['t2', 't3']);
    expect(getSlot(ws, b, TODAY, 'day').crew.map((t) => t.id)).toEqual(['t1']);
    // الأيام القادمة كذلك تتبع الشفت الجديد
    const bDay = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => addDays(TODAY, n)).find((d) => getSlot(ws, b, d, 'day').shift?.id === 'b-B')!;
    expect(getSlot(ws, b, bDay, 'day').crew.map((t) => t.id)).toContain('t2');
  });

  test('تكليف ليوم واحد مستقل عن الشفت الأساسي', () => {
    let ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    ws = assignForDay(ws, 't3', 'b', TODAY, 'day', true);
    expect(getSlot(ws, b, TODAY, 'day').crew.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(getSlot(ws, b, TODAY, 'day').dayAssigned).toBe(true);
    // الشفت الأساسي لم يتغير، واليوم التالي لا يتأثر
    expect(ws.technicians.find((t) => t.id === 't3')!.baseShiftId).toBe('b-B');
    expect(getSlot(ws, b, addDays(TODAY, 1), 'day').crew.map((t) => t.id)).toEqual(['t1', 't2']);
    // إلغاء التكليف يعيد الشفت لدورته بدون تعديل محفوظ
    ws = assignForDay(ws, 't3', 'b', TODAY, 'day', false);
    expect(ws.overrides).toEqual({});
  });

  test('تبديل شفت يوم في الجدول ثم استعادته', () => {
    let ws = fixture();
    const b = ws.departments.find((d) => d.id === 'b')!;
    ws = setSlotShift(ws, 'b', TODAY, 'day', 'b-B');
    expect(getSlot(ws, b, TODAY, 'day').crew.map((t) => t.id)).toEqual(['t3']);
    ws = setSlotShift(ws, 'b', TODAY, 'day', 'b-A');
    expect(ws.overrides).toEqual({});
  });
});

describe('الزيارات', () => {
  test('تسجيل زيارتين لنفس القسم في نفس اليوم كسجلين مستقلين قابلين للتعديل', () => {
    let ws = fixture();
    const first = addVisit(ws, { departmentId: 'b', date: TODAY, time: '08:00', site: 'موقع 1', technicianIds: ['t1', 't2'] }, TODAY, STAMP);
    ws = first.ws;
    const second = addVisit(ws, { departmentId: 'b', date: TODAY, time: '10:00', site: 'موقع 2', technicianIds: ['t1'] }, TODAY, STAMP);
    ws = second.ws;
    expect(ws.visits).toHaveLength(2);
    expect(first.visit.id).not.toBe(second.visit.id);
    expect(technicianVisits(ws, 't1', TODAY)).toHaveLength(2);
    expect(technicianVisits(ws, 't2', TODAY)).toHaveLength(1);

    ws = updateVisit(ws, second.visit.id, { departmentId: 'b', date: TODAY, time: '10:30', site: 'موقع 2 معدل', technicianIds: ['t2'] }, TODAY);
    expect(ws.visits.find((v) => v.id === first.visit.id)!.site).toBe('موقع 1');
    expect(ws.visits.find((v) => v.id === second.visit.id)!.site).toBe('موقع 2 معدل');
    expect(technicianVisits(ws, 't1', TODAY)).toHaveLength(1);
    expect(technicianVisits(ws, 't2', TODAY)).toHaveLength(2);

    ws = deleteVisit(ws, first.visit.id);
    expect(ws.visits.map((v) => v.id)).toEqual([second.visit.id]);
  });

  test('نافذة آخر 6 أشهر والألوان: صفر أحمر، واحدة أصفر، اثنتان أخضر', () => {
    let ws = fixture();
    ws = addVisit(ws, { departmentId: 'b', date: '2026-05-08', time: '08:00', site: 'قديمة', technicianIds: ['t1'] }, TODAY).ws;
    ws = addVisit(ws, { departmentId: 'b', date: '2026-05-09', time: '08:00', site: 'ضمن النافذة', technicianIds: ['t1'] }, TODAY).ws;
    expect(technicianVisits(ws, 't1', TODAY).map((v) => v.site)).toEqual(['ضمن النافذة']);
    expect(tone(0, 2)).toBe('red');
    expect(tone(1, 2)).toBe('amber');
    expect(tone(2, 2)).toBe('green');
    expect(tone(3, 2)).toBe('green');
  });

  test('ما يقبل زيارة بدون فنيين أو بتاريخ قادم', () => {
    const ws = fixture();
    expect(() => addVisit(ws, { departmentId: 'b', date: TODAY, time: '08:00', site: 'x', technicianIds: [] }, TODAY)).toThrow();
    expect(() => addVisit(ws, { departmentId: 'b', date: '2026-11-10', time: '08:00', site: 'x', technicianIds: ['t1'] }, TODAY)).toThrow();
  });
});

describe('الاجتماعات', () => {
  test('حفظ حضور أكثر من اجتماع دفعة واحدة', () => {
    let ws = fixture();
    const m1 = addMeeting(ws, 'اجتماع السلامة', 2026);
    ws = m1.ws;
    const m2 = addMeeting(ws, 'مراجعة خطة الطوارئ', 2026);
    ws = m2.ws;
    expect(() => addMeeting(ws, '  اجتماع   السلامة ', 2026)).toThrow('موجود');

    const result = saveAttendanceBatch(ws, { departmentId: 'b', date: TODAY, entries: { [m1.meeting.id]: ['t1', 't2'], [m2.meeting.id]: ['t1'] } }, STAMP);
    ws = result.ws;
    expect(result.created).toBe(2);
    expect(ws.attendance).toHaveLength(2);
    expect([...attendedMeetings(ws, 't1', 2026)].sort()).toEqual([m1.meeting.id, m2.meeting.id].sort());
    expect([...attendedMeetings(ws, 't2', 2026)]).toEqual([m1.meeting.id]);
    expect(techProgress(ws, ws.technicians[1], TODAY).meetingRemaining).toBe(1);

    // إعادة الحفظ تحدّث نفس السجلات، والقائمة الفارغة تحذف السجل
    const again = saveAttendanceBatch(ws, { departmentId: 'b', date: TODAY, entries: { [m1.meeting.id]: ['t2'], [m2.meeting.id]: [] } }, STAMP);
    expect(again).toMatchObject({ created: 0, updated: 1, removed: 1 });
    expect(again.ws.attendance).toHaveLength(1);
    expect(again.ws.attendance[0].technicianIds).toEqual(['t2']);
  });

  test('حضور اجتماع بتاريخ ووقت محددين، وتعديل الوقت لاحقًا', () => {
    let ws = fixture();
    const m = addMeeting(ws, 'اجتماع سابق', 2026);
    ws = m.ws;
    ws = saveAttendanceBatch(ws, { departmentId: 'b', date: '2026-11-02', time: '13:30', entries: { [m.meeting.id]: ['t1'] } }, STAMP).ws;
    expect(ws.attendance[0]).toMatchObject({ date: '2026-11-02', time: '13:30' });
    const updated = saveAttendanceBatch(ws, { departmentId: 'b', date: '2026-11-02', time: '14:00', entries: { [m.meeting.id]: ['t1'] } }, STAMP);
    expect(updated).toMatchObject({ created: 0, updated: 1 });
    expect(updated.ws.attendance[0].time).toBe('14:00');
    // يوم ثاني = سجل مستقل
    const other = saveAttendanceBatch(updated.ws, { departmentId: 'b', date: '2026-11-03', time: '09:00', entries: { [m.meeting.id]: ['t2'] } }, STAMP);
    expect(other.ws.attendance).toHaveLength(2);
  });
});

describe('التقارير', () => {
  function reportFixture() {
    let ws = fixture();
    const meeting = addMeeting(ws, 'اجتماع نوفمبر', 2026);
    ws = meeting.ws;
    // زيارة واحدة شملت ثلاثة فنيين
    ws = addVisit(ws, { departmentId: 'b', date: '2026-11-02', time: '09:00', site: 'جماعية', technicianIds: ['t1', 't2', 't3'] }, TODAY).ws;
    ws = addVisit(ws, { departmentId: 'b', date: '2026-11-09', time: '09:00', site: 'ثانية', technicianIds: ['t1'] }, TODAY).ws;
    ws = addVisit(ws, { departmentId: 'c', date: '2026-10-20', time: '09:00', site: 'أكتوبر', technicianIds: ['t4'] }, TODAY).ws;
    ws = saveAttendanceBatch(ws, { departmentId: 'b', date: '2026-11-03', entries: { [meeting.meeting.id]: ['t1', 't3'] } }).ws;
    return ws;
  }

  test('الزيارة الجماعية تُحسب مرة في التقرير ومرة لكل فني في سجله', () => {
    const ws = reportFixture();
    const report = buildReport(ws, { mode: 'month', year: 2026, month: 10, quarter: 3, departmentId: 'all' }, TODAY);
    expect(report.totals).toEqual({ visits: 2, technicianVisits: 4, techniciansVisited: 3, meetingSessions: 1, meetingsHeld: 1, attendance: 2 });
    expect(technicianVisits(ws, 't2', TODAY)).toHaveLength(1);
    expect(technicianVisits(ws, 't1', TODAY)).toHaveLength(2);
    const b = report.sections.find((s) => s.departmentId === 'b')!;
    expect(b.visits).toBe(2);
    expect(report.sections.find((s) => s.departmentId === 'c')!.visits).toBe(0);
    // مجموع الأسابيع = إجمالي الشهر
    expect(report.buckets.reduce((sum, bucket) => sum + bucket.visits, 0)).toBe(2);
    expect(report.buckets[0].visits).toBe(1); // 1–7
    expect(report.buckets[1].visits).toBe(1); // 8–14
  });

  test('التقرير الربع سنوي والسنوي وفلتر القسم', () => {
    const ws = reportFixture();
    const quarter = buildReport(ws, { mode: 'quarter', year: 2026, month: 0, quarter: 3, departmentId: 'all' }, TODAY);
    expect(quarter.totals.visits).toBe(3);
    expect(quarter.buckets.map((b) => b.visits)).toEqual([1, 2, 0]);
    const year = buildReport(ws, { mode: 'year', year: 2026, month: 0, quarter: 0, departmentId: 'c' }, TODAY);
    expect(year.totals.visits).toBe(1);
    expect(year.sections).toHaveLength(1);
    expect(year.coverage).toHaveLength(1);
  });

  test('المتبقي على كل قسم وشفت ومن باقي عليه', () => {
    const ws = reportFixture();
    const report = buildReport(ws, { mode: 'month', year: 2026, month: 10, quarter: 3, departmentId: 'b' }, TODAY);
    const b = report.coverage[0];
    const shiftA = b.shifts.find((s) => s.shift.id === 'b-A')!;
    // t1 زيارتان (مكتمل)، t2 زيارة واحدة → متبقي 1. الاجتماع: t1 حضر، t2 لا → 1
    expect(shiftA.coverage).toMatchObject({ people: 2, visitRemaining: 1, attendanceRemaining: 1, visitComplete: 1, meetingComplete: 1, complete: 1 });
    const shiftB = b.shifts.find((s) => s.shift.id === 'b-B')!;
    expect(shiftB.coverage).toMatchObject({ people: 1, visitRemaining: 1, attendanceRemaining: 0 });
    expect(b.coverage.visitRemaining).toBe(2);
    expect(report.pending.map((p) => p.technician.id)).toEqual(['t2', 't3']);
    // t1 زيارتان، t2 و t3 زيارة وحدة. الاجتماع: t1 و t3 حضروا، t2 لا
    expect(report.statusMix).toEqual({ visits: { none: 0, partial: 2, complete: 1 }, meetings: { none: 1, partial: 0, complete: 2 } });
    const csv = reportCsv(report);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"فني اثنان","502","طوارئ","طوارئ أ","1","1"');
  });

  test('أولوية المتابعة مرتبة حسب الزيارات ثم الحضور', () => {
    const ws = reportFixture();
    const list = followUpList(ws, TODAY);
    expect(list[0].visitRemaining).toBeGreaterThanOrEqual(list[list.length - 1].visitRemaining);
    expect(list.find((p) => p.technician.id === 't1')).toBeUndefined();
  });
});

describe('وضع التجربة', () => {
  test('بيانات التجربة متسقة: خطة اليوم والفنيون والزيارات', () => {
    const ws = demoWorkspace(TODAY);
    expect(ws.technicians).toHaveLength(56); // مع قسم التشغيل
    expect(tasksOn(ws, TODAY)).toHaveLength(4);
    expect(technicianVisits(ws, 'a1', TODAY)).toHaveLength(2);
    // a1 و a4 زيارتهما في نفس اليوم في نفس القسم → سجل واحد
    const shared = ws.visits.filter((v) => v.technicianIds.includes('a1') && v.technicianIds.includes('a4'));
    expect(shared).toHaveLength(1);
    expect(attendedMeetings(ws, 'a1', 2026).size).toBe(3);
  });
});
