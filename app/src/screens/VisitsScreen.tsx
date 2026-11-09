import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { visitDetails, visitTitle } from '../domain/records';
import { activeTechnicians, currentSlot, periodRange, shiftLabel } from '../domain/shifts';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Row, SectionTitle, Segmented, Spread, Sub, T } from '../ui/kit';
import { TechRow } from '../ui/TechRow';
import { useUi } from '../ui/ui';
import { PlacesView } from './PlacesView';
import { DepartmentPicker } from './DepartmentPicker';

function CrewVisits() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [scope, setScope] = useState<'shift' | 'all'>('shift');
  const [limit, setLimit] = useState(5);
  // بدون اختيار: نفتح على أول قسم بدل صفحة فاضية.
  const departmentId = ui.departmentId ?? ws.departments[0]?.id ?? null;
  const department = ws.departments.find((item) => item.id === departmentId);
  const slot = department ? currentSlot(ws, department, now) : null;
  const crew = !department ? [] : scope === 'shift' ? slot?.crew ?? [] : activeTechnicians(ws).filter((tech) => tech.departmentId === department.id);
  const history = department
    ? ws.visits
        .map((visit, order) => ({ visit, order }))
        .filter(({ visit }) => visit.departmentId === department.id)
        .sort((a, b) => (b.visit.date + b.visit.time).localeCompare(a.visit.date + a.visit.time) || b.order - a.order)
        .map(({ visit }) => visit)
    : [];
  const todayCount = history.filter((visit) => visit.date === now.date).length;

  return (
    <View>
      <SectionTitle title="الزيارات الميدانية" sub={'هدف كل فني ' + ws.settings.visitTarget + ' زيارات خلال آخر ' + ws.settings.visitWindowMonths + ' أشهر.'} />
      <DepartmentPicker value={departmentId} onChange={ui.setDepartmentId} icon="map-pin" />

      {department ? (
        <>
          <Card>
            <Spread style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '800', fontSize: 16 }}>{department.name + ' · ' + shiftLabel(slot)}</T>
                <Sub>{slot ? periodRange(slot.period) + ' · ' + slot.crew.length + ' فني' : 'ما فيه فنيون مجدولون الآن'}</Sub>
              </View>
              <Button testID="add-visit" icon="plus" label="إضافة زيارة" onPress={() => ui.openVisit({ departmentId: department.id })} />
            </Spread>
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
            {crew.length ? (
              crew.map((tech) => <TechRow key={tech.id} ws={ws} tech={tech} asOf={now.date} />)
            ) : (
              <Sub>{scope === 'shift' ? 'ما فيه فنيون على رأس العمل الآن. اختر «كل فنيي القسم».' : 'ما فيه فنيون في القسم. أضفهم من الإعدادات.'}</Sub>
            )}
            <Row gap={6} style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <Chip tone="green" label="مكتمل" />
              <Chip tone="amber" label="جزئي" />
              <Chip tone="red" label="صفر" />
            </Row>
          </Card>

          <SectionTitle title={'سجل زيارات ' + department.name} sub={history.length + ' زيارة مسجلة · ' + todayCount + ' اليوم'} />
          <Card style={{ paddingVertical: 4 }}>
            {history.length ? (
              history.slice(0, limit).map((visit, index) => (
                <Spread key={visit.id} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '700' }}>{visitTitle(visit)}</T>
                    {visitDetails(visit) ? <Sub>{visitDetails(visit)}</Sub> : null}
                    <Sub>{formatDate(visit.date, { year: true }) + ' · ' + visit.time + ' · ' + visit.technicianIds.length + ' فني'}</Sub>
                    <Sub numberOfLines={2}>
                      {visit.technicianIds.map((id) => ws.technicians.find((tech) => tech.id === id)?.name ?? '—').join('، ')}
                    </Sub>
                  </View>
                  <Button small variant="secondary" label="تعديل" testID={'edit-visit-' + visit.id} onPress={() => ui.openVisit({ departmentId: department.id, visitId: visit.id })} />
                </Spread>
              ))
            ) : (
              <Empty text="الزيارات اللي تسجلها تظهر هنا." />
            )}
            {history.length > limit ? <Button small variant="ghost" label="عرض المزيد" onPress={() => setLimit(limit + 15)} /> : null}
          </Card>
        </>
      ) : (
        <Card>
          <Empty text="اختر قسمًا لعرض فنيي شفته الحالي وسجل زياراته." />
        </Card>
      )}
    </View>
  );
}

/** الزيارات: زيارات الفنيين، أو المستودعات ونقاط الانطلاق. */
export function VisitsScreen() {
  const [view, setView] = useState<'crew' | 'places'>('crew');
  return (
    <View>
      <View style={{ marginTop: 6 }}>
        <Segmented
          options={[
            { value: 'crew', label: 'زيارات الفنيين' },
            { value: 'places', label: 'المستودعات والانطلاق' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'crew' ? <CrewVisits /> : <PlacesView />}
    </View>
  );
}
