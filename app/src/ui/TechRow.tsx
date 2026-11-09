import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDate } from '../domain/dates';
import { initials, shiftName } from '../domain/shifts';
import { techProgress, tone, yearMeetings } from '../domain/stats';
import type { Technician, Workspace } from '../domain/types';
import { Avatar, C, Chip, Icon, ratio, Row, Sub, T } from './kit';

export function TechStatus({ ws, tech, asOf }: { ws: Workspace; tech: Technician; asOf: string }) {
  const progress = techProgress(ws, tech, asOf);
  return (
    <Row gap={4} style={{ flexWrap: 'wrap' }}>
      <Chip tone={tone(progress.visitCount, ws.settings.visitTarget)} label={'زيارات ' + ratio(progress.visitCount, ws.settings.visitTarget)} />
      <Chip
        tone={tone(progress.attended.size, progress.meetingTarget)}
        label={'اجتماعات ' + ratio(progress.attended.size, progress.meetingTarget)}
      />
    </Row>
  );
}

export function TechDetails({ ws, tech, asOf }: { ws: Workspace; tech: Technician; asOf: string }) {
  const progress = techProgress(ws, tech, asOf);
  const meetings = yearMeetings(ws, Number(asOf.slice(0, 4)));
  return (
    <View style={{ backgroundColor: '#f8f6fc', borderRadius: 12, padding: 10, marginTop: 8, gap: 6 }}>
      <Sub>
        {progress.visits.length
          ? 'زيارات آخر ' + ws.settings.visitWindowMonths + ' أشهر: ' + progress.visits.map((visit) => formatDate(visit.date) + ' (' + visit.site + ')').join(' · ')
          : 'ما فيه زيارات مسجلة خلال آخر ' + ws.settings.visitWindowMonths + ' أشهر'}
      </Sub>
      <Row gap={4} style={{ flexWrap: 'wrap' }}>
        {meetings.length ? (
          meetings.map((meeting) => (
            <Chip key={meeting.id} tone={progress.attended.has(meeting.id) ? 'green' : 'red'} label={meeting.title + ' · ' + (progress.attended.has(meeting.id) ? 'حضر' : 'غير مسجل')} />
          ))
        ) : (
          <Sub>ما فيه اجتماعات مضافة لهذه السنة</Sub>
        )}
      </Row>
    </View>
  );
}

/** صف فني: الاسم والرقم الوظيفي والشفت الأساسي ومؤشرات الزيارات والاجتماعات، مع تفاصيل قابلة للفتح. */
export function TechRow({
  ws,
  tech,
  asOf,
  right,
  badge,
  showShift = true,
}: {
  ws: Workspace;
  tech: Technician;
  asOf: string;
  right?: React.ReactNode;
  badge?: React.ReactNode;
  showShift?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 10 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={'سجل ' + tech.name} onPress={() => setOpen(!open)} style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          <Avatar text={initials(tech.name)} />
          <View style={{ flex: 1, gap: 3 }}>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <T style={{ fontWeight: '700', fontSize: 14 }}>{tech.name}</T>
              {showShift ? <Chip tone="purple" icon="layers" label={'الأساسي: ' + shiftName(ws, tech)} /> : null}
              {badge}
            </Row>
            <Sub>{'الرقم الوظيفي ' + tech.employeeNumber}</Sub>
            <TechStatus ws={ws} tech={tech} asOf={asOf} />
          </View>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
        </Pressable>
        {right}
      </Row>
      {open ? <TechDetails ws={ws} tech={tech} asOf={asOf} /> : null}
    </View>
  );
}
