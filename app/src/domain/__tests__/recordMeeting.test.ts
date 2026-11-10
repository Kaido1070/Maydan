import { addMeeting, recordAttendance, updateAttendanceRecord } from '../records';
import { emptyWorkspace } from '../seed';
import { attendedMeetings, meetingRemaining } from '../stats';
import type { Workspace } from '../types';

const TODAY = '2026-11-10';

function fixture(): { ws: Workspace; m1: string; m2: string } {
  let ws = emptyWorkspace('2026-11-01');
  const [a, b] = ws.departments;
  ws = {
    ...ws,
    technicians: [
      { id: 't1', name: 'أحمد', employeeNumber: '101', departmentId: a.id, baseShiftId: a.shifts[0].id },
      { id: 't2', name: 'سالم', employeeNumber: '102', departmentId: b.id, baseShiftId: b.shifts[0].id },
      { id: 't3', name: 'موظف مكتب', employeeNumber: '103', departmentId: b.id, baseShiftId: b.shifts[0].id, workplace: 'office' },
    ],
  };
  const first = addMeeting(ws, 'العزل', 2026);
  const second = addMeeting(first.ws, 'الارتفاعات', 2026);
  return { ws: second.ws, m1: first.meeting.id, m2: second.meeting.id };
}

describe('تسجيل اجتماع من صفحته', () => {
  test('حاضرون من أكثر من قسم (ومنهم مكتبي) في أكثر من اجتماع، والإضافة ما تمسح المسجلين', () => {
    const { ws: start, m1, m2 } = fixture();
    let result = recordAttendance(start, { meetingIds: [m1, m2], date: TODAY, time: '09:30', technicianIds: ['t1', 't3', 't1'] }, TODAY);
    expect(result).toMatchObject({ created: 4, people: 2 });
    let ws = result.ws;
    expect(attendedMeetings(ws, 't3', 2026)).toEqual(new Set([m1, m2]));
    // تسجيل ثاني لنفس الاجتماع واليوم: ينضاف على الموجود
    result = recordAttendance(ws, { meetingIds: [m1], date: TODAY, time: '11:00', technicianIds: ['t2'] }, TODAY);
    expect(result.created).toBe(0);
    ws = result.ws;
    expect(meetingRemaining(ws, m1).remaining).toEqual([]);
    expect(meetingRemaining(ws, m2).remaining.map((t) => t.id)).toEqual(['t2']);
    expect(ws.attendance.find((item) => item.meetingId === m1 && item.technicianIds.includes('t2'))!.technicianIds.sort()).toEqual(['t2', 't3']);
  });

  test('التحقق: اجتماع، حاضرون، تاريخ ووقت', () => {
    const { ws, m1 } = fixture();
    const base = { meetingIds: [m1], date: TODAY, time: '09:30', technicianIds: ['t1'] };
    expect(() => recordAttendance(ws, { ...base, meetingIds: [] }, TODAY)).toThrow('اختر الاجتماع');
    expect(() => recordAttendance(ws, { ...base, technicianIds: [] }, TODAY)).toThrow('حاضرًا');
    expect(() => recordAttendance(ws, { ...base, date: '2026-11-11' }, TODAY)).toThrow('قادم');
    expect(() => recordAttendance(ws, { ...base, time: '9' }, TODAY)).toThrow('24');
  });

  test('تعديل سجل محفوظ: تبديل الحاضرين، والقائمة الفاضية تحذفه', () => {
    const { ws: start, m1 } = fixture();
    let ws = recordAttendance(start, { meetingIds: [m1], date: TODAY, technicianIds: ['t1'] }, TODAY).ws;
    const id = ws.attendance[0].id;
    ws = updateAttendanceRecord(ws, id, { technicianIds: ['t2', 't3'], time: '14:00' });
    expect(ws.attendance[0]).toMatchObject({ technicianIds: ['t2', 't3'], time: '14:00' });
    expect(updateAttendanceRecord(ws, id, { technicianIds: [] }).attendance).toEqual([]);
  });
});
