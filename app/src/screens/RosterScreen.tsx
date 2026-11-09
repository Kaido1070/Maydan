import React, { useState } from 'react';
import { View } from 'react-native';
import { addDays, formatDate, WEEKDAYS_AR } from '../domain/dates';
import { crewForShift, getSlot, OFF, periodRange, techTag } from '../domain/shifts';
import type { Department } from '../domain/types';
import { useStore } from '../store';
import { Button, C, Card, Chip, Row, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';

export function rotationText(department: Department): string {
  const rotation = department.rotation;
  if (rotation.kind === 'weekly') {
    return 'دوام أسبوعي: ' + rotation.workDays.map((d) => WEEKDAYS_AR[d]).join('، ') + ' · ' + department.periods.map((p) => p.name + ' ' + periodRange(p)).join(' · ');
  }
  const names = Object.fromEntries(department.periods.map((p) => [p.id, p.name]));
  const pattern = rotation.pattern.map((value) => (value === OFF ? 'راحة' : names[value] ?? value)).join('، ');
  return (
    'دورة ' + rotation.pattern.length + ' أيام تبدأ ' + formatDate(rotation.anchorDate, { year: true }) + ': ' + pattern +
    ' · كل شفت يتأخر ' + rotation.staggerDays + ' أيام عن السابق · ' + department.periods.map((p) => p.name + ' ' + periodRange(p)).join(' · ')
  );
}

export function RosterScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const date = ui.rosterDate ?? now.date;
  const [view, setView] = useState<'day' | 'people'>('day');

  return (
    <View>
      <SectionTitle title="جدول الشفتات" sub="بدّل شفت يوم معيّن أو كلّف فنيين ليوم واحد، أو انقل الفني لشفت أساسي جديد." />
      <View style={{ marginBottom: 10 }}>
        <Segmented
          options={[
            { value: 'day', label: 'توزيع اليوم' },
            { value: 'people', label: 'الشفت الأساسي للفنيين' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'day' ? (
        <>
          <Card>
            <Spread style={{ flexWrap: 'wrap' }}>
              <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '800' }}>{formatDate(date, { weekday: true, year: true })}</T>
                {date !== now.date ? <Button small variant="ghost" label="العودة لليوم" onPress={() => ui.setRosterDate(now.date)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : <Sub>اليوم</Sub>}
              </View>
              <Stepper label={formatDate(date)} onPrev={() => ui.setRosterDate(addDays(date, -1))} onNext={() => ui.setRosterDate(addDays(date, 1))} />
            </Spread>
          </Card>
          {ws.departments.map((department) =>
            department.periods.map((period) => {
              const slot = getSlot(ws, department, date, period.id);
              return (
                <Card key={department.id + period.id}>
                  <Spread style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '800' }}>{department.name + ' · ' + period.name}</T>
                      <Sub>{periodRange(period)}</Sub>
                    </View>
                    <Button small variant="secondary" label="تعديل اليوم" testID={'slot-' + department.id + '-' + period.id} onPress={() => ui.openSlot({ departmentId: department.id, date, periodId: period.id })} />
                  </Spread>
                  <Row gap={4} style={{ flexWrap: 'wrap', marginTop: 6 }}>
                    <Chip tone={slot.shift ? 'purple' : 'neutral'} label={slot.shift?.name ?? 'بدون شفت'} />
                    {slot.shiftChanged ? <Chip tone="amber" label="مبدّل عن الدورة" /> : null}
                    {slot.dayAssigned ? <Chip tone="amber" label="تكليف يوم" /> : null}
                  </Row>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {slot.crew.length ? (
                      slot.crew.map((tech) => (
                        <View key={tech.id} style={{ backgroundColor: tech.baseShiftId === slot.shift?.id ? C.subtle : C.amberBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <T style={{ fontSize: 11 }}>{tech.name}</T>
                        </View>
                      ))
                    ) : (
                      <Sub>بدون فنيين</Sub>
                    )}
                  </View>
                </Card>
              );
            }),
          )}
        </>
      ) : (
        ws.departments.map((department) => (
          <Card key={department.id}>
            <T style={{ fontWeight: '800', fontSize: 16 }}>{department.name}</T>
            <Sub>{rotationText(department)}</Sub>
            {department.shifts.map((shift) => {
              const crew = crewForShift(ws, department.id, shift.id);
              return (
                <View key={shift.id} style={{ marginTop: 10 }}>
                  <Chip tone="purple" label={shift.name + ' · ' + crew.length + ' فني'} />
                  {crew.map((tech) => (
                    <Spread key={tech.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }}>
                      <View style={{ flex: 1 }}>
                        <T style={{ fontSize: 13 }}>{tech.name}</T>
                        <Sub style={{ fontSize: 11 }}>{techTag(tech)}</Sub>
                      </View>
                      <Button small variant="secondary" label="نقل/تكليف" testID={'roster-move-' + tech.id} onPress={() => ui.openTechnician(tech.id, date)} />
                    </Spread>
                  ))}
                </View>
              );
            })}
          </Card>
        ))
      )}
      <Sub style={{ marginTop: 4 }}>بداية الدورات وأوقات الدوام تُعدّل من الإعدادات ← الأقسام والشفتات.</Sub>
    </View>
  );
}
