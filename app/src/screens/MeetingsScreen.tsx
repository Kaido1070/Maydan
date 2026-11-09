import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { formatDate } from '../domain/dates';
import { addMeeting, attendanceFor, saveAttendanceBatch } from '../domain/records';
import { activeTechnicians, currentSlot, shiftLabel, shiftName } from '../domain/shifts';
import { yearMeetings } from '../domain/stats';
import { useApply, useStore } from '../store';
import { Button, C, Card, Checkbox, Chip, Empty, Icon, ratio, Row, s, SectionTitle, Segmented, Spread, Sub, T } from '../ui/kit';
import { TechRow } from '../ui/TechRow';
import { useUi } from '../ui/ui';
import { DepartmentPicker } from './DepartmentPicker';

export function MeetingsScreen() {
  const { ws, now } = useStore();
  const apply = useApply();
  const ui = useUi();
  const year = Number(now.date.slice(0, 4));
  const meetings = yearMeetings(ws, year);
  const [selected, setSelected] = useState<string[]>(() => (ui.focusMeetingId ? [ui.focusMeetingId] : meetings.slice(-1).map((m) => m.id)));
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [scope, setScope] = useState<'shift' | 'all'>('shift');
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  const department = ws.departments.find((item) => item.id === ui.departmentId);
  const slot = department ? currentSlot(ws, department, now) : null;

  useEffect(() => setDraft({}), [ui.departmentId]);

  const chosen = meetings.filter((meeting) => selected.includes(meeting.id));
  const crew = useMemo(() => {
    if (!department) return [];
    const recorded = new Set(chosen.flatMap((meeting) => attendanceFor(ws, meeting.id, department.id, now.date)?.technicianIds ?? []));
    const shiftIds = new Set((slot?.crew ?? []).map((tech) => tech.id));
    return activeTechnicians(ws).filter(
      (tech) =>
        shiftIds.has(tech.id) || recorded.has(tech.id) || (scope === 'all' && tech.departmentId === department.id),
    );
  }, [ws, department, slot, scope, chosen, now.date]);

  const saved = (meetingId: string) => (department ? attendanceFor(ws, meetingId, department.id, now.date)?.technicianIds ?? [] : []);
  const value = (meetingId: string) => draft[meetingId] ?? saved(meetingId);
  const setCell = (meetingId: string, techId: string, checked: boolean) =>
    setDraft((prev) => {
      const list = prev[meetingId] ?? saved(meetingId);
      return { ...prev, [meetingId]: checked ? [...list, techId] : list.filter((id) => id !== techId) };
    });
  const dirty = Object.keys(draft).some((id) => selected.includes(id));

  const addTitle = () => {
    let created = '';
    const error = apply((current) => {
      const result = addMeeting(current, title, year);
      created = result.meeting.id;
      return result.ws;
    });
    if (error) return setTitleError(error);
    setTitle('');
    setTitleError(null);
    setSelected((list) => [...list, created]);
    ui.notify('تمت إضافة الاجتماع وتحديده');
  };

  const save = () => {
    if (!department) return;
    const entries = Object.fromEntries(chosen.map((meeting) => [meeting.id, value(meeting.id)]));
    let summary = { created: 0, updated: 0, removed: 0 };
    const error = apply((current) => {
      const result = saveAttendanceBatch(current, { departmentId: department.id, date: now.date, entries });
      summary = result;
      return result.ws;
    });
    if (error) return ui.notify(error);
    setDraft({});
    ui.notify(
      summary.created
        ? 'تم حفظ حضور ' + chosen.length + ' اجتماع · \u2066+' + summary.created * ws.settings.xpMeeting + ' XP\u2069'
        : 'تم تحديث حضور الاجتماعات',
    );
  };

  const history = department
    ? ws.attendance.filter((item) => item.departmentId === department.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    : [];

  return (
    <View>
      <SectionTitle title="الاجتماعات" sub="حدد اجتماعًا أو أكثر واختر القسم، ثم علّم على حضور كل فني واحفظ دفعة واحدة." />

      <Card>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>إضافة عنوان اجتماع</T>
        <Row>
          <TextInput
            testID="meeting-title-input"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setTitleError(null);
            }}
            onSubmitEditing={addTitle}
            placeholder="مثال: مراجعة خطة الطوارئ"
            placeholderTextColor="#a29db3"
            maxLength={80}
            returnKeyType="done"
            style={[s.input, { flex: 1, minWidth: 0 }]}
          />
          <Button testID="meeting-title-add" icon="plus" label="إضافة" onPress={addTitle} disabled={!title.trim()} />
        </Row>
        {titleError ? <T style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{titleError}</T> : null}

        <Spread style={{ marginTop: 14, marginBottom: 6 }}>
          <T style={{ fontWeight: '800' }}>{'الاجتماعات المختارة · ' + chosen.length + ' من ' + meetings.length}</T>
          <Sub>{'سنة ' + year}</Sub>
        </Spread>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {meetings.length ? (
            meetings.map((meeting) => {
              const on = selected.includes(meeting.id);
              return (
                <Pressable
                  key={meeting.id}
                  testID={'pick-meeting-' + meeting.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSelected((list) => (on ? list.filter((id) => id !== meeting.id) : [...list, meeting.id]))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    minHeight: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: on ? '#cdbbf6' : C.line,
                    backgroundColor: on ? '#efe9ff' : C.white,
                  }}
                >
                  <Icon name={on ? 'check-square' : 'square'} size={16} color={on ? C.purple : C.muted} />
                  <T style={{ fontSize: 13, color: on ? '#4827ac' : '#55466e', fontWeight: on ? '700' : '400' }}>{meeting.title}</T>
                </Pressable>
              );
            })
          ) : (
            <Sub>ما فيه اجتماعات لهذه السنة. أضف عنوانًا من الأعلى.</Sub>
          )}
        </View>
      </Card>

      <DepartmentPicker value={ui.departmentId} onChange={ui.setDepartmentId} icon="users" />

      {department ? (
        <Card>
          <T style={{ fontWeight: '800', fontSize: 16 }}>{department.name + ' · ' + shiftLabel(slot)}</T>
          <Sub>{'حضور اليوم ' + formatDate(now.date, { weekday: true })}</Sub>
          <View style={{ marginVertical: 10 }}>
            <Segmented
              options={[
                { value: 'shift', label: 'الشفت الحالي' },
                { value: 'all', label: 'كل فنيي القسم' },
              ]}
              value={scope}
              onChange={setScope}
            />
          </View>

          {!chosen.length ? (
            <Sub>حدد اجتماعًا من القائمة لعرض الحضور وتسجيله.</Sub>
          ) : !crew.length ? (
            <Sub>ما فيه فنيون على رأس العمل الآن. اختر «كل فنيي القسم».</Sub>
          ) : (
            <>
              <Row gap={4} style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                {chosen.map((meeting) => (
                  <Chip key={meeting.id} tone={value(meeting.id).length ? 'green' : 'neutral'} label={meeting.title + ' ' + ratio(value(meeting.id).filter((id) => crew.some((t) => t.id === id)).length, crew.length)} />
                ))}
              </Row>
              <ScrollView horizontal={chosen.length > 2} contentContainerStyle={{ flexGrow: 1 }}>
                <View style={{ flex: 1, minWidth: chosen.length > 2 ? 140 + chosen.length * 78 : undefined }}>
                  <Row style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 6 }} gap={0}>
                    <Sub style={{ flex: 1, fontWeight: '700' }}>الفني</Sub>
                    {chosen.map((meeting) => (
                      <Pressable
                        key={meeting.id}
                        accessibilityRole="button"
                        accessibilityLabel={'تحديد الكل في ' + meeting.title}
                        onPress={() => {
                          const all = crew.every((tech) => value(meeting.id).includes(tech.id));
                          setDraft((prev) => ({ ...prev, [meeting.id]: all ? [] : [...new Set([...value(meeting.id), ...crew.map((t) => t.id)])] }));
                        }}
                        style={{ width: 78, alignItems: 'center' }}
                      >
                        <Sub style={{ fontWeight: '700', textAlign: 'center', fontSize: 11 }} numberOfLines={2}>
                          {meeting.title}
                        </Sub>
                        <T style={{ color: C.purple, fontSize: 10 }}>الكل</T>
                      </Pressable>
                    ))}
                  </Row>
                  {crew.map((tech) => (
                    <Row key={tech.id} gap={0} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 }}>
                      <View style={{ flex: 1 }}>
                        <T style={{ fontSize: 13, fontWeight: '600' }}>{tech.name}</T>
                        <Sub style={{ fontSize: 10 }}>{tech.employeeNumber + ' · ' + shiftName(ws, tech)}</Sub>
                      </View>
                      {chosen.map((meeting) => (
                        <View key={meeting.id} style={{ width: 78, alignItems: 'center' }}>
                          <Checkbox
                            testID={'att-' + meeting.id + '-' + tech.id}
                            label={tech.name + ' · ' + meeting.title}
                            checked={value(meeting.id).includes(tech.id)}
                            onChange={(checked) => setCell(meeting.id, tech.id, checked)}
                          />
                        </View>
                      ))}
                    </Row>
                  ))}
                </View>
              </ScrollView>
              <Button
                testID="attendance-save"
                style={{ marginTop: 12 }}
                icon="save"
                label={'حفظ الحضور · ' + chosen.length + (chosen.length === 1 ? ' اجتماع' : ' اجتماعات')}
                onPress={save}
                disabled={!dirty}
              />
              {dirty ? <Sub style={{ textAlign: 'center', marginTop: 4 }}>فيه تغييرات غير محفوظة</Sub> : null}
            </>
          )}
        </Card>
      ) : (
        <Card>
          <Empty text="اختر قسمًا لعرض حضور فنيي الشفت الحالي." />
        </Card>
      )}

      {department ? (
        <>
          <SectionTitle title={'سجل حضور ' + department.name} sub="آخر سجلات الحضور المحفوظة" />
          <Card style={{ paddingVertical: 4 }}>
            {history.length ? (
              history.map((item, index) => (
                <Spread key={item.id} style={{ paddingVertical: 9, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '700' }}>{ws.meetings.find((m) => m.id === item.meetingId)?.title ?? '—'}</T>
                    <Sub>{formatDate(item.date, { year: true })}</Sub>
                  </View>
                  <Chip tone="green" label={item.technicianIds.length + ' حاضر'} />
                </Spread>
              ))
            ) : (
              <Empty text="ما فيه حضور مسجل لهذا القسم." />
            )}
          </Card>
          <SectionTitle title="حالة الفنيين" sub="حضور كل فني لاجتماعات السنة" />
          <Card style={{ paddingVertical: 4 }}>
            {activeTechnicians(ws)
              .filter((tech) => tech.departmentId === department.id)
              .map((tech) => (
                <TechRow key={tech.id} ws={ws} tech={tech} asOf={now.date} />
              ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}
