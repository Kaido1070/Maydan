import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatDate } from '../domain/dates';
import { addPlace, deletePlace, PLACE_HINT, PLACE_ICON, PLACE_NOUN, placeStatus, renamePlace, warehouseQuarter } from '../domain/places';
import type { Place, PlaceKind } from '../domain/types';
import { confirm } from '../sheets/VisitSheet';
import { visitDetails, visitTitle } from '../domain/records';
import { useApply, useStore } from '../store';
import { Button, C, Card, Chip, Empty, Field, Icon, Progress, Row, s, SectionTitle, Segmented, Sheet, Spread, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';

/** زيارات المستودعات ونقاط الانطلاق: الهدف عدد مستودعات كل ربع سنة. */
export function PlacesView() {
  const { ws, now } = useStore();
  const ui = useUi();
  const status = placeStatus(ws, now.date);
  const quarter = warehouseQuarter(ws, now.date);
  const placeIds = new Set(status.map((item) => item.place.id));
  const [editing, setEditing] = useState<Place | null>(null);
  const history = ws.visits.filter((visit) => visit.target === 'equipment' || (visit.placeId && placeIds.has(visit.placeId))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 15);

  return (
    <View>
      <SectionTitle
        title="المستودعات والمواقع والمعدات"
        sub={status.length ? 'المطلوب زيارة ' + (quarter.goal === 2 ? 'مستودعين' : quarter.goal + ' مستودعات') + ' كل ربع سنة.' : 'سجّل مستودعاتك ونقاط الانطلاق ومعدات التوزيع، وبعدها تسجّل زياراتها هنا.'}
      />
      {quarter.total ? (
        <View testID="warehouse-quarter" style={{ backgroundColor: quarter.remaining ? C.amberBg : C.greenBg, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <Spread>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }}>{'مستودعات ' + quarter.label}</T>
              <Sub>{quarter.remaining ? (quarter.remaining === 1 ? 'باقي مستودع واحد' : quarter.remaining === 2 ? 'باقي مستودعين' : 'باقي ' + quarter.remaining + ' مستودعات') + ' · ' + quarter.daysLeft + ' يوم على نهاية الربع' : 'حققت هدف الربع 👏'}</Sub>
            </View>
            <T style={{ fontSize: 26, fontWeight: '700', lineHeight: 34, color: quarter.remaining ? C.amber : C.green }}>{'\u2066' + Math.min(quarter.visited, quarter.goal) + ' / ' + quarter.goal + '\u2069'}</T>
          </Spread>
          <Progress value={quarter.visited} max={quarter.goal} color={quarter.remaining ? '#d98a00' : C.green} track="#ffffffaa" />
        </View>
      ) : null}
      <AddPlace />
      {status.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {status.map((item, index) => (
            <Spread key={item.place.id} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <Row style={{ flex: 1 }}>
                <Icon name={PLACE_ICON[item.place.kind]} size={18} color={item.visitedThisQuarter ? C.green : item.place.kind === 'warehouse' ? C.amber : C.muted} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }}>{item.place.name}</T>
                  <Sub>{PLACE_NOUN[item.place.kind] + ' · ' + (item.lastVisit ? 'آخر زيارة ' + formatDate(item.lastVisit.date) : 'ما انزار أبدًا')}</Sub>
                  {item.visitedThisQuarter ? <Chip tone="green" label="انزار هالربع" /> : item.place.kind === 'warehouse' ? <Chip tone="amber" label="ما انزار هالربع" /> : null}
                </View>
              </Row>
              <View style={{ gap: 6 }}>
                <Button testID={'place-visit-' + item.place.id} small label="زيارة" icon="map-pin" onPress={() => ui.openVisit({ departmentId: item.place.departmentId ?? '', placeId: item.place.id })} />
                <Button testID={'place-edit-' + item.place.id} small variant="ghost" label="تعديل" onPress={() => setEditing(item.place)} />
              </View>
            </Spread>
          ))}
        </Card>
      ) : (
        <Card>
          <Empty text="ما سجلت مستودعات أو نقاط انطلاق أو معدات للحين. أضفها من فوق." />
        </Card>
      )}
      <Button testID="add-equipment-visit" variant="secondary" icon="zap" label="زيارة معدة بدون تسجيلها" style={{ marginBottom: 4 }} onPress={() => ui.openVisit({ departmentId: '', equipment: true })} />
      {history.length ? (
        <>
          <SectionTitle title="آخر زياراتها" />
          <Card style={{ paddingVertical: 4 }}>
            {history.map((visit, index) => (
              <Spread key={visit.id} style={{ paddingVertical: 9, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{visit.target === 'equipment' ? visit.location || visitTitle(visit) : visitTitle(visit)}</T>
                  <Sub>{formatDate(visit.date, { weekday: true }) + ' · ' + visit.time + (visitDetails(visit) ? ' · ' + visitDetails(visit) : '')}</Sub>
                </View>
                <Button small variant="secondary" label="تعديل" onPress={() => ui.openVisit({ departmentId: visit.departmentId, visitId: visit.id })} />
              </Spread>
            ))}
          </Card>
        </>
      ) : null}
      <EditPlace place={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function AddPlace() {
  const apply = useApply();
  const ui = useUi();
  const [kind, setKind] = useState<PlaceKind>('warehouse');
  const [name, setName] = useState('');
  const add = () => {
    const error = apply((c) => addPlace(c, { kind, name }));
    if (error) return ui.notify(error);
    setName('');
    ui.notify('تم تسجيل ' + PLACE_NOUN[kind]);
  };
  return (
    <Card>
      <T style={{ fontWeight: '700', marginBottom: 6 }}>تسجيل مكان جديد</T>
      <Segmented
        options={[
          { value: 'warehouse', label: 'مستودع' },
          { value: 'staging', label: 'نقطة انطلاق' },
          { value: 'equipment', label: 'معدة' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Row style={{ marginTop: 8 }}>
        <TextInput
          testID="place-name"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder={PLACE_HINT[kind]}
          placeholderTextColor={C.placeholder}
          style={[s.input, { flex: 1, minWidth: 0 }]}
        />
        <Button testID="place-add" icon="plus" label="تسجيل" disabled={!name.trim()} onPress={add} />
      </Row>
    </Card>
  );
}

function EditPlace({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const apply = useApply();
  const ui = useUi();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceKind>('warehouse');
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  if (place && current !== place.id) {
    setCurrent(place.id);
    setName(place.name);
    setKind(place.kind);
    setError(null);
  }
  if (!place) return null;
  return (
    <Sheet
      visible
      onClose={() => (setCurrent(null), onClose())}
      title={'تعديل ' + PLACE_NOUN[place.kind]}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button
              testID="place-save"
              style={{ flex: 1 }}
              label="حفظ"
              onPress={() => {
                const failure = apply((c) => renamePlace(c, place.id, { name, kind }));
                if (failure) return setError(failure);
                ui.notify('تم الحفظ');
                setCurrent(null);
                onClose();
              }}
            />
            <Button
              variant="danger"
              label="حذف"
              onPress={() =>
                confirm('حذف «' + place.name + '»؟ زياراته السابقة تبقى في السجل.', () => {
                  apply((c) => deletePlace(c, place.id));
                  setCurrent(null);
                  onClose();
                })
              }
            />
          </Row>
        </>
      }
    >
      <Segmented
        options={[
          { value: 'warehouse', label: 'مستودع' },
          { value: 'staging', label: 'نقطة انطلاق' },
          { value: 'equipment', label: 'معدة' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <View style={{ height: 10 }} />
      <Field testID="place-edit-name" label="الاسم" value={name} onChangeText={setName} />
    </Sheet>
  );
}
