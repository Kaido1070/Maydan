import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { addDays, formatDate, isTime } from '../domain/dates';
import { addMeeting, recordAttendance, updateAttendanceRecord } from '../domain/records';
import { yearMeetings } from '../domain/stats';
import { useApply, useStore } from '../store';
import { Button, C, Field, Icon, KIND, Row, s, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';
import { PeoplePicker } from '../ui/PeoplePicker';
import { Touch } from '../ui/touch';
import { confirm } from './VisitSheet';

export type MeetingTarget = { meetingIds?: string[]; departmentId?: string | null; technicianIds?: string[]; recordId?: string } | null;

/** صفحة تسجيل اجتماع: العنوان، الوقت، والحاضرون (بحث في كل الأقسام). أو تعديل سجل محفوظ. */
export function MeetingSheet({ target, onClose, onSaved }: { target: MeetingTarget; onClose: () => void; onSaved: (message: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const record = target?.recordId ? ws.attendance.find((item) => item.id === target.recordId) : undefined;
  const year = Number(now.date.slice(0, 4));
  const meetings = yearMeetings(ws, year);

  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [people, setPeople] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setTitle('');
    if (record) {
      setSelected([record.meetingId]);
      setDate(record.date);
      setTime(record.time ?? now.time);
      setPeople(record.technicianIds);
      setDepartmentId(record.departmentId);
    } else {
      setSelected(target.meetingIds ?? meetings.slice(-1).map((item) => item.id));
      setDate(now.date);
      setTime(now.time);
      setPeople(target.technicianIds ?? []);
      setDepartmentId(target.departmentId ?? ws.departments[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;

  const addTitle = () => {
    let created = '';
    const failure = apply((current) => {
      const result = addMeeting(current, title, year);
      created = result.meeting.id;
      return result.ws;
    });
    if (failure) return setError(failure);
    setTitle('');
    setError(null);
    setSelected((list) => [...list, created]);
  };

  const save = () => {
    if (record) {
      const failure = apply((current) => updateAttendanceRecord(current, record.id, { technicianIds: people, time }));
      if (failure) return setError(failure);
      return onSaved(people.length ? 'تم تحديث الحضور' : 'تم حذف سجل الحضور');
    }
    let summary = { created: 0, people: 0 };
    const failure = apply((current) => {
      const result = recordAttendance(current, { meetingIds: selected, date, time, technicianIds: people }, now.date);
      summary = result;
      return result.ws;
    });
    if (failure) return setError(failure);
    onSaved('تم تسجيل حضور ' + summary.people + (selected.length > 1 ? ' في ' + selected.length + ' اجتماعات' : '') + (summary.created ? ' · ⁦+' + summary.created * ws.settings.xpMeeting + ' XP⁩' : ''));
  };

  const remove = () =>
    confirm('حذف سجل الحضور هذا؟', () => {
      apply((current) => updateAttendanceRecord(current, record!.id, { technicianIds: [] }));
      onSaved('تم حذف سجل الحضور');
    });

  const ready = !!selected.length && !!people.length && isTime(time);
  const recordTitle = record ? ws.meetings.find((item) => item.id === record.meetingId)?.title ?? 'اجتماع' : '';

  return (
    <Sheet
      visible
      onClose={onClose}
      title={record ? 'تعديل حضور اجتماع' : 'تسجيل اجتماع'}
      sub={(record ? recordTitle + ' · ' : '') + formatDate(date, { weekday: true })}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button
              testID="attendance-save"
              style={{ flex: 1, backgroundColor: KIND.meeting.solid }}
              icon="check"
              label={record ? 'حفظ التعديل · ' + people.length + ' حاضر' : people.length ? 'حفظ حضور ' + people.length : 'حدد الحاضرين'}
              onPress={save}
              disabled={record ? !isTime(time) : !ready}
            />
            {record ? <Button variant="danger" label="حذف" onPress={remove} /> : null}
          </Row>
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: KIND.meeting.bg, borderRadius: 14, padding: 10, marginBottom: 14 }}>
        <Icon name="users" size={18} color={KIND.meeting.fg} />
        <T style={{ flex: 1, color: KIND.meeting.fg, fontWeight: '700' }}>{record ? 'تعدّل سجل حضور محفوظ' : 'أنت تسجّل اجتماع'}</T>
      </View>

      {record ? null : (
        <>
          <T style={s.label}>{'الاجتماع' + (selected.length > 1 ? ' · ' + selected.length + ' مختارة' : '')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {meetings.map((meeting) => {
              const on = selected.includes(meeting.id);
              return (
                <Touch
                  key={meeting.id}
                  testID={'pick-meeting-' + meeting.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  feedback="select"
                  onPress={() => setSelected((list) => (on ? list.filter((id) => id !== meeting.id) : [...list, meeting.id]))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: on ? KIND.meeting.solid : C.line, backgroundColor: on ? KIND.meeting.bg : C.white }}
                >
                  <Icon name={on ? 'check-circle' : 'circle'} size={16} color={on ? KIND.meeting.fg : C.muted} />
                  <T style={{ fontSize: 14, color: on ? KIND.meeting.fg : C.ink, fontWeight: on ? '700' : '500' }}>{meeting.title}</T>
                </Touch>
              );
            })}
          </View>
          {!meetings.length ? <Sub style={{ marginTop: 4 }}>ما فيه عناوين لهذه السنة. اكتب أول عنوان تحت.</Sub> : null}
          <Row style={{ marginTop: 8, marginBottom: 14 }}>
            <TextInput
              testID="meeting-title-input"
              value={title}
              onChangeText={(text) => (setTitle(text), setError(null))}
              onSubmitEditing={addTitle}
              placeholder="عنوان جديد"
              placeholderTextColor={C.placeholder}
              maxLength={80}
              returnKeyType="done"
              style={[s.input, { flex: 1, minWidth: 0 }]}
            />
            <Button testID="meeting-title-add" variant="secondary" icon="plus" label="إضافة" onPress={addTitle} disabled={!title.trim()} />
          </Row>
          <Spread style={{ marginBottom: 10 }}>
            <T style={s.label}>تاريخ الاجتماع</T>
            <Stepper label={date === now.date ? 'اليوم' : formatDate(date)} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= now.date} />
          </Spread>
        </>
      )}
      <Field testID="meeting-time" label="وقت الاجتماع (24 ساعة)" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" maxLength={5} />
      {!isTime(time) ? <T style={{ color: C.red, fontSize: 12, marginTop: -6, marginBottom: 6 }}>اكتب الوقت بصيغة 24 ساعة مثل 09:30</T> : null}

      <T style={[s.label, { marginBottom: 6 }]}>الحاضرون</T>
      <PeoplePicker value={people} onChange={setPeople} departmentId={departmentId} onDepartment={setDepartmentId} date={date} time={isTime(time) ? time : now.time} includeOffice testPrefix="att-" noun="حاضر" />
    </Sheet>
  );
}
