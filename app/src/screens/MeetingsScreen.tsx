import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { addDays, formatDate, isTime } from '../domain/dates';
import { addMeeting, attendanceFor, saveAttendanceBatch } from '../domain/records';
import { activeTechnicians, currentSlot, shiftLabel, shiftName, slotAt, techTag } from '../domain/shifts';
import { meetingRemaining, yearMeetings } from '../domain/stats';
import { useApply, useStore } from '../store';
import { Button, C, Card, Checkbox, Chip, Empty, Field, Icon, KIND, Progress, ratio, Row, s, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';
import { TalkCard } from '../ui/TalkCard';
import { DepartmentPicker } from './DepartmentPicker';
import { Touch } from '../ui/touch';

export function MeetingsScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [view, setView] = useState<'attend' | 'remaining' | 'topics'>('attend');
  const [limit, setLimit] = useState(8);
  const year = Number(now.date.slice(0, 4));
  const meetings = yearMeetings(ws, year);
  const weekStart = addDays(now.date, -new Date(now.date + 'T12:00:00Z').getUTCDay());
  const mine = ws.attendance.filter((item) => !item.seed);
  const week = mine.filter((item) => item.date >= weekStart && item.date <= now.date);
  const today = mine.filter((item) => item.date === now.date);
  const people = (list: typeof mine) => new Set(list.flatMap((item) => item.technicianIds)).size;
  const history = [...ws.attendance].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')) || b.updatedAt.localeCompare(a.updatedAt));
  const deptName = (id: string) => ws.departments.find((item) => item.id === id)?.name ?? '—';

  return (
    <View>
      <SectionTitle title="الاجتماعات" />
      <View style={{ marginBottom: 12 }}>
        <Segmented
          options={[
            { value: 'attend', label: 'تسجيل الحضور' },
            { value: 'remaining', label: 'من باقي؟' },
            { value: 'topics', label: 'مواضيع مقترحة' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'topics' ? <TalkCard onAdopt={(id) => ui.openMeeting({ meetingIds: [id], departmentId: ui.departmentId })} /> : null}
      {view === 'remaining' ? <MeetingFollowUp /> : null}

      {view === 'attend' ? (
        <>
          <View style={{ backgroundColor: KIND.meeting.bg, borderRadius: 20, padding: 16, marginBottom: 12 }}>
            <T style={{ fontWeight: '700', fontSize: 18, color: KIND.meeting.fg }}>
              {today.length ? 'اليوم سجلت حضور ' + people(today) + ' 👏' : 'سجّل اجتماع اليوم'}
            </T>
            <Sub style={{ marginTop: 2 }}>
              {week.length ? 'هالأسبوع: ' + new Set(week.map((item) => item.meetingId + item.date)).size + ' اجتماعات · ' + people(week) + ' حاضر' : 'تفتح لك صفحة تختار فيها الاجتماع والحاضرين بالبحث.'}
            </Sub>
            <Button
              testID="add-meeting"
              style={{ marginTop: 12, backgroundColor: KIND.meeting.solid }}
              icon="plus"
              label="تسجيل اجتماع"
              onPress={() => ui.openMeeting({ meetingIds: ui.focusMeetingId ? [ui.focusMeetingId] : undefined, departmentId: ui.departmentId })}
            />
            {!meetings.length ? <Sub style={{ marginTop: 8 }}>ما فيه عناوين اجتماعات للحين. تقدر تضيف العنوان من داخل صفحة التسجيل.</Sub> : null}
          </View>

          <SectionTitle title="آخر الاجتماعات المسجلة" sub="اضغط على السجل عشان تعدّل الحاضرين." />
          <Card style={{ paddingVertical: 4 }}>
            {history.length ? (
              history.slice(0, limit).map((item, index) => (
                <Touch
                  key={item.id}
                  testID={'attendance-' + item.id}
                  accessibilityRole="button"
                  scaleTo={0.985}
                  onPress={() => ui.openMeeting({ recordId: item.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={{ fontWeight: '700' }}>{ws.meetings.find((m) => m.id === item.meetingId)?.title ?? '—'}</T>
                    <Sub>{deptName(item.departmentId) + ' · ' + formatDate(item.date, { weekday: true }) + (item.time ? ' · ' + item.time : '')}</Sub>
                  </View>
                  <Chip tone="green" label={item.technicianIds.length + ' حاضر'} />
                  <Icon name="chevron-left" size={16} color={C.muted} />
                </Touch>
              ))
            ) : (
              <Empty text="الاجتماعات اللي تسجلها تطلع هنا." />
            )}
            {history.length > limit ? <Button small variant="ghost" label={'عرض المزيد · ' + (history.length - limit)} onPress={() => setLimit(limit + 15)} /> : null}
          </Card>
        </>
      ) : null}
    </View>
  );
}

/** متابعة اجتماع: اختر اجتماعًا (وقسمًا) ويطلع كم موظف باقي ما حضره، ومن هم. */
function MeetingFollowUp() {
  const { ws, now } = useStore();
  const ui = useUi();
  const meetings = yearMeetings(ws, Number(now.date.slice(0, 4)));
  const [meetingId, setMeetingId] = useState<string>(() => meetings[meetings.length - 1]?.id ?? '');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [limit, setLimit] = useState(10);
  const meeting = meetings.find((item) => item.id === meetingId) ?? meetings[meetings.length - 1];
  if (!meeting) return null;
  const result = meetingRemaining(ws, meeting.id, departmentId);
  const deptName = (id: string) => ws.departments.find((d) => d.id === id)?.name ?? '—';

  return (
    <Card>
      <T style={{ fontWeight: '800', fontSize: 16 }}>من باقي عليه الاجتماع؟</T>
      <Sub style={{ marginBottom: 8 }}>اختر الاجتماع والقسم.</Sub>
      <Segmented wrap options={meetings.map((item) => ({ value: item.id, label: item.title }))} value={meeting.id} onChange={(id) => (setMeetingId(id), setLimit(10))} />
      <View style={{ height: 8 }} />
      <Segmented
        wrap
        options={[{ value: 'all', label: 'كل الأقسام' }, ...ws.departments.map((d) => ({ value: d.id, label: d.name }))]}
        value={departmentId}
        onChange={(id) => (setDepartmentId(id), setLimit(10))}
      />
      <View testID="meeting-remaining" style={{ backgroundColor: result.remaining.length ? KIND.meeting.bg : C.greenBg, borderRadius: 14, padding: 12, marginTop: 12 }}>
        <Spread>
          <View>
            <T style={{ fontSize: 30, fontWeight: '700', lineHeight: 40, color: result.remaining.length ? KIND.meeting.fg : C.green }}>{result.remaining.length}</T>
            <T style={{ fontSize: 13 }}>{result.remaining.length ? 'باقي ما حضروا' : 'الكل حضر 🎉'}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T style={{ fontWeight: '700' }}>{ratio(result.attended, result.total)}</T>
            <Sub>حضروا</Sub>
          </View>
        </Spread>
        <Progress value={result.attended} max={Math.max(result.total, 1)} color={C.green} track="#ffffffaa" />
      </View>
      {result.remaining.slice(0, limit).map((tech, index) => (
        <Touch
          key={tech.id}
          accessibilityRole="button"
          onPress={() => ui.openPerson(tech.id)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: index ? 1 : 0, borderTopColor: C.line, marginTop: index ? 0 : 6 }}
        >
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>{tech.name}</T>
            <Sub>{deptName(tech.departmentId) + ' · ' + (tech.workplace === 'office' ? 'مكتبي' : shiftName(ws, tech))}</Sub>
          </View>
          <Icon name="chevron-left" size={16} color={C.muted} />
        </Touch>
      ))}
      {result.remaining.length > limit ? <Button small variant="ghost" label={'عرض الباقين · ' + (result.remaining.length - limit)} onPress={() => setLimit(limit + 20)} /> : null}
    </Card>
  );
}
