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
import { Image } from 'react-native';
import { photoSrc } from '../photos';
import type { Visit } from '../domain/types';
import { Touch } from '../ui/touch';

/**
 * قسمين منفصلين في الزيارات بنفس الشكل:
 * المستودعات ونقاط الانطلاق (هدف المستودعات كل ربع سنة)، ومعدات التوزيع.
 */
export function PlacesView({ mode = 'places' }: { mode?: 'places' | 'equipment' }) {
  const { ws, now } = useStore();
  const ui = useUi();
  const equipment = mode === 'equipment';
  const status = placeStatus(ws, now.date).filter((item) => (item.place.kind === 'equipment') === equipment);
  const quarter = warehouseQuarter(ws, now.date);
  const placeIds = new Set(status.map((item) => item.place.id));
  const [editing, setEditing] = useState<Place | null>(null);
  const all = ws.visits.filter((visit) => (equipment && visit.target === 'equipment') || (visit.placeId && placeIds.has(visit.placeId))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const history = equipment ? all : all.slice(0, 15);

  return (
    <View>
      <SectionTitle
        title={equipment ? 'معدات التوزيع' : 'المستودعات ونقاط الانطلاق'}
        sub={
          equipment
            ? 'محطة، محول، لوحة... سجّل المعدة مرة وحدة، وزرها بدون فنيين.'
            : status.length
              ? 'المطلوب زيارة ' + (quarter.goal === 2 ? 'مستودعين' : quarter.goal + ' مستودعات') + ' كل ربع سنة.'
              : 'سجّل مستودعاتك ونقاط الانطلاق، وبعدها تسجّل زياراتها هنا.'
        }
      />
      {!equipment && quarter.total ? (
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
      <AddPlace kinds={equipment ? ['equipment'] : ['warehouse', 'staging']} />
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
          <Empty text={equipment ? 'ما سجلت معدات للحين. أضفها من فوق.' : 'ما سجلت مستودعات أو نقاط انطلاق للحين. أضفها من فوق.'} />
        </Card>
      )}
      {equipment ? (
        <Button testID="add-equipment-visit" variant="secondary" icon="zap" label="زيارة معدة بدون تسجيلها" style={{ marginBottom: 4 }} onPress={() => ui.openVisit({ departmentId: '', equipment: true })} />
      ) : null}
      {equipment ? <GearNotes visits={history} /> : null}
      {!equipment && history.length ? (
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

/** ملاحظات المعدات: المفتوحة (تحتاج صورة بعد) والمقفلة، مع صورة قبل وبعد. */
function GearNotes({ visits }: { visits: Visit[] }) {
  const { ws, now } = useStore();
  const ui = useUi();
  const [list, setList] = useState<'open' | 'closed'>('open');
  const [limit, setLimit] = useState(10);
  const open = visits.filter((visit) => !visit.closedAt);
  const closed = visits.filter((visit) => visit.closedAt).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const rows = list === 'open' ? open : closed;
  const thumb = (photos?: { id: string; uri: string; takenAt: string }[]) =>
    photos?.[0] ? (
      <Image source={{ uri: photoSrc(photos[0]) }} style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: C.track }} />
    ) : (
      <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: C.subtle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="image" size={16} color={C.muted} />
      </View>
    );
  return (
    <View testID="gear-notes">
      <SectionTitle title="ملاحظات المعدات" sub="كل زيارة معدة تبقى مفتوحة لين تقفلها بصورة بعد." />
      <View style={{ marginBottom: 10 }}>
        <Segmented
          options={[
            { value: 'open', label: 'المفتوحة · ' + open.length },
            { value: 'closed', label: 'المقفلة · ' + closed.length },
          ]}
          value={list}
          onChange={(value) => (setList(value), setLimit(10))}
        />
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {rows.slice(0, limit).map((visit, index) => {
          const name = ws.places?.find((place) => place.id === visit.placeId)?.name ?? (visit.location || 'معدة');
          const age = Math.max(0, Math.round((new Date((visit.closedAt ?? now.date) + 'T12:00:00Z').getTime() - new Date(visit.date + 'T12:00:00Z').getTime()) / 86400000));
          return (
            <Touch
              key={visit.id}
              testID={'gear-note-' + visit.id}
              accessibilityRole="button"
              accessibilityLabel={name}
              scaleTo={0.98}
              onPress={() => ui.openVisit({ departmentId: '', visitId: visit.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}
            >
              {thumb(visit.before)}
              {visit.closedAt ? thumb(visit.after) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '700' }} numberOfLines={1}>{name}</T>
                {visit.site ? <Sub numberOfLines={2}>{visit.site}</Sub> : null}
                <Sub style={{ color: visit.closedAt ? C.green : age > 7 ? C.red : C.amber }}>
                  {visit.closedAt ? 'انقفلت بعد ' + age + ' يوم' : age ? 'مفتوحة من ' + age + ' يوم' : 'انسجلت اليوم'}
                  {visit.location && visit.placeId ? ' · ' + visit.location : ''}
                </Sub>
              </View>
              <Icon name="chevron-left" size={16} color={C.muted} />
            </Touch>
          );
        })}
        {!rows.length ? <Empty text={list === 'open' ? 'ما فيه ملاحظات مفتوحة 👍' : 'ما قفلت شي للحين.'} /> : null}
        {rows.length > limit ? <Button small variant="ghost" label="عرض المزيد" onPress={() => setLimit(limit + 15)} /> : null}
      </Card>
      <Sub style={{ marginTop: 2 }}>تقرير صور قبل وبعد يتجهز لما ترسل صيغته.</Sub>
    </View>
  );
}

function AddPlace({ kinds }: { kinds: PlaceKind[] }) {
  const apply = useApply();
  const ui = useUi();
  const [picked, setKind] = useState<PlaceKind>(kinds[0]);
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const [name, setName] = useState('');
  const add = () => {
    const error = apply((c) => addPlace(c, { kind, name }));
    if (error) return ui.notify(error);
    setName('');
    ui.notify('تم تسجيل ' + PLACE_NOUN[kind]);
  };
  return (
    <Card>
      <T style={{ fontWeight: '700', marginBottom: 6 }}>{kinds.length === 1 ? 'تسجيل ' + PLACE_NOUN[kinds[0]] + ' جديدة' : 'تسجيل مكان جديد'}</T>
      {kinds.length > 1 ? <Segmented options={kinds.map((value) => ({ value, label: PLACE_NOUN[value] }))} value={kind} onChange={setKind} /> : null}
      <Row style={{ marginTop: kinds.length > 1 ? 8 : 0 }}>
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
