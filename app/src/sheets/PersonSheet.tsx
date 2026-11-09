import React from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { currentSlot, periodRange, shiftLabel, shiftName, techTag } from '../domain/shifts';
import { techProgress, tone, yearMeetings } from '../domain/stats';
import { useStore } from '../store';
import { Button, C, Chip, Progress, ratio, Row, Sheet, Spread, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';

/** تفاصيل فني أو فريق: الشفت، الزيارات، الاجتماعات، وأزرار التسجيل المباشر. */
export function PersonSheet({ technicianId, onClose }: { technicianId: string | null; onClose: () => void }) {
  const { ws, now } = useStore();
  const ui = useUi();
  const tech = ws.technicians.find((item) => item.id === technicianId);
  if (!tech) return null;
  const department = ws.departments.find((item) => item.id === tech.departmentId);
  const progress = techProgress(ws, tech, now.date);
  const meetings = yearMeetings(ws, Number(now.date.slice(0, 4)));
  const slot = department ? currentSlot(ws, department, now) : null;
  const onShift = !!slot?.crew.some((item) => item.id === tech.id);
  const allVisits = ws.visits.filter((visit) => visit.technicianIds.includes(tech.id)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const lastVisit = allVisits[0];
  const lastMeeting = ws.attendance.filter((item) => item.technicianIds.includes(tech.id)).sort((a, b) => b.date.localeCompare(a.date))[0];

  const recordVisit = () => {
    onClose();
    ui.openVisit({ departmentId: tech.departmentId, technicianIds: [tech.id] });
  };
  const recordMeeting = () => {
    onClose();
    ui.go('meetings', { departmentId: tech.departmentId, meetingId: progress.missingMeetings[0]?.id });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={tech.name}
      sub={techTag(tech, true) + ' · ' + (department?.name ?? '—')}
      footer={
        <Row>
          <Button testID="person-visit" style={{ flex: 1 }} icon="map-pin" label="تسجيل زيارة" onPress={recordVisit} />
          <Button testID="person-meeting" style={{ flex: 1 }} variant="secondary" icon="users" label="تسجيل حضور" onPress={recordMeeting} />
        </Row>
      }
    >
      <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
        <Spread>
          <T style={{ fontWeight: '700' }}>الشفت</T>
          <Chip tone={onShift ? 'green' : 'neutral'} label={onShift ? 'على رأس العمل الآن' : 'خارج الدوام الآن'} />
        </Spread>
        <Sub>{'الشفت الأساسي: ' + shiftName(ws, tech)}</Sub>
        {onShift && slot ? <Sub>{shiftLabel(slot) + ' · ' + periodRange(slot.period)}</Sub> : null}
        <Button small variant="ghost" icon="repeat" label="نقل أو تكليف ليوم" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => (onClose(), ui.openTechnician(tech.id))} />
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
        <Spread>
          <T style={{ fontWeight: '700' }}>{'الزيارات · آخر ' + ws.settings.visitWindowMonths + ' أشهر'}</T>
          <Chip tone={tone(progress.visitCount, ws.settings.visitTarget)} label={ratio(progress.visitCount, ws.settings.visitTarget)} />
        </Spread>
        <Progress value={progress.visitCount} max={ws.settings.visitTarget} />
        <Sub>{lastVisit ? 'آخر زيارة: ' + formatDate(lastVisit.date, { year: true }) + ' · ' + lastVisit.site : 'ما طلعت عليه زيارة أبدًا'}</Sub>
        {progress.visits.map((visit) => (
          <Row key={visit.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 6, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14 }}>{visit.site}</T>
              <Sub>{formatDate(visit.date, { weekday: true, year: true }) + ' · ' + visit.time + (visit.technicianIds.length > 1 ? ' · مع ' + (visit.technicianIds.length - 1) + ' آخرين' : '')}</Sub>
            </View>
          </Row>
        ))}
        {allVisits.length > progress.visits.length ? <Sub style={{ marginTop: 4 }}>{'وزيارات أقدم: ' + (allVisits.length - progress.visits.length)}</Sub> : null}
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 }}>
        <Spread>
          <T style={{ fontWeight: '700' }}>{'الاجتماعات · ' + now.date.slice(0, 4)}</T>
          <Chip tone={tone(progress.attended.size, progress.meetingTarget)} label={ratio(progress.attended.size, progress.meetingTarget)} />
        </Spread>
        <Progress value={progress.attended.size} max={progress.meetingTarget} color="#278969" />
        <Sub>{lastMeeting ? 'آخر حضور: ' + formatDate(lastMeeting.date, { year: true }) : 'ما حضر أي اجتماع'}</Sub>
        <Row gap={4} style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {meetings.length ? (
            meetings.map((meeting) => (
              <Chip key={meeting.id} tone={progress.attended.has(meeting.id) ? 'green' : 'red'} label={meeting.title + ' · ' + (progress.attended.has(meeting.id) ? 'حضر' : 'باقي')} />
            ))
          ) : (
            <Sub>ما فيه اجتماعات مضافة لهذه السنة.</Sub>
          )}
        </Row>
      </View>
    </Sheet>
  );
}
