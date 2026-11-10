import React, { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { addDays, formatDate, isTime } from '../domain/dates';
import { PLACE_NOUN, PLACE_WORK_TYPE } from '../domain/places';
import { addVisit, closeEquipmentVisit, deleteVisit, EQUIPMENT_KINDS, EQUIPMENT_WORK_TYPE, reopenEquipmentVisit, updateVisit, validateVisit, workTypeSuggestions } from '../domain/records';
import type { Photo } from '../domain/types';
import { deletePhotoFiles } from '../photos';
import { PhotoField } from '../ui/PhotoField';
import { LocationField } from '../ui/LocationField';
import { PeoplePicker } from '../ui/PeoplePicker';
import { s as s2 } from '../ui/kit';
import { slotAt } from '../domain/shifts';
import type { PlanItem } from '../domain/types';
import { useApply, useStore } from '../store';
import { Button, C, Field, Icon, KIND, Row, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';
import { Touch } from '../ui/touch';

export type VisitTarget = { departmentId: string; visitId?: string; planItem?: PlanItem; date?: string; technicianIds?: string[]; placeId?: string; equipment?: boolean } | null;

export function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert('تأكيد', message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'نعم', style: 'destructive', onPress: onYes },
  ]);
}

export function VisitSheet({ target, onClose, onSaved }: { target: VisitTarget; onClose: () => void; onSaved: (message: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const existing = target?.visitId ? ws.visits.find((visit) => visit.id === target.visitId) : undefined;
  const department = ws.departments.find((item) => item.id === (existing?.departmentId ?? target?.departmentId));
  const place = (ws.places ?? []).find((item) => item.id === (existing?.placeId ?? target?.placeId));

  const equipment = (existing?.target ?? (target?.equipment ? 'equipment' : undefined)) === 'equipment';
  /** زيارة معدة (مسجلة أو لا): صور قبل، ووصف الملاحظة، والموقع، وتنقفل بصور بعد. */
  const gear = equipment || place?.kind === 'equipment';

  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [site, setSite] = useState('');
  const [workType, setWorkType] = useState('');
  const [location, setLocation] = useState('');
  const [taskNumber, setTaskNumber] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<Photo[]>([]);
  const [after, setAfter] = useState<Photo[]>([]);
  const [closeNote, setCloseNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [mapUrl, setMapUrl] = useState<string | undefined>(undefined);
  /** القسم المعروض في قائمة الاختيار (غير قسم الزيارة نفسه). */
  const [pickDept, setPickDept] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setPickDept(null);
    if (existing) {
      setDate(existing.date);
      setTime(existing.time);
      setSite(existing.workType || existing.location || existing.taskNumber ? existing.site : '');
      setWorkType(existing.workType ?? '');
      // الزيارات القديمة: الموقع كان في حقل الوصف
      setLocation(existing.location ?? (existing.workType || existing.taskNumber ? '' : existing.site));
      setTaskNumber(existing.taskNumber ?? '');
      setPeople(existing.technicianIds);
      setBefore(existing.before ?? []);
      setAfter(existing.after ?? []);
      setCloseNote(existing.closeNote ?? '');
      setCoords(existing.coords);
      setMapUrl(existing.mapUrl);
    } else {
      setBefore([]);
      setAfter([]);
      setCoords(undefined);
      setMapUrl(undefined);
      setCloseNote('');
      const date = target.date ?? now.date;
      const time = target.planItem?.time ?? now.time;
      setDate(date);
      setTime(time);
      setSite('');
      setWorkType(place ? PLACE_WORK_TYPE[place.kind] : target.equipment ? EQUIPMENT_WORK_TYPE : target.planItem?.title ?? '');
      setLocation(place && place.kind !== 'equipment' ? place.name : '');
      setTaskNumber('');
      const slot = department && isTime(time) ? slotAt(ws, department, date, time) : null;
      setPeople(target.technicianIds ?? (target.planItem ? (slot?.crew ?? []).map((tech) => tech.id) : []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target || (!department && !place && !equipment)) return null;
  const free = !!place || equipment;

  const input = { departmentId: department?.id ?? '', placeId: place?.id, target: equipment ? ('equipment' as const) : undefined, before: gear ? before : undefined, coords, mapUrl, date, time, workType, location, taskNumber, site, technicianIds: people, planItemId: existing?.planItemId ?? target.planItem?.id };

  // صور انضافت في هالنافذة وما انحفظت: تنحذف من الجهاز إذا تسكرت بدون حفظ.
  const added = (list: Photo[], saved?: Photo[]) => list.filter((photo) => !(saved ?? []).some((item) => item.id === photo.id));
  const dismiss = () => {
    deletePhotoFiles([...added(before, existing?.before), ...added(after, existing?.after)]);
    onClose();
  };
  const closeIt = () => {
    if (!existing) return;
    const failure = apply((current) => closeEquipmentVisit(updateVisit(current, existing.id, input, now.date), existing.id, { after, note: closeNote, date: now.date }));
    if (failure) return setError(failure);
    onSaved('🎉 انقفلت ملاحظة ' + (place?.name ?? location));
  };
  const reopen = () => {
    if (!existing) return;
    apply((current) => reopenEquipmentVisit(current, existing.id));
    onSaved('رجعت مفتوحة');
  };

  const save = () => {
    if (gear && !before.length) return setError('أرفق صورة قبل');
    if (gear && !site.trim()) return setError('اكتب وصف الملاحظة');
    const problem = validateVisit(ws, input, now.date);
    if (problem) return setError(problem);
    const failure = apply((current) => (existing ? updateVisit(current, existing.id, input, now.date) : addVisit(current, input, now.date).ws));
    if (failure) return setError(failure);
    if (existing) deletePhotoFiles((existing.before ?? []).filter((photo) => !before.some((item) => item.id === photo.id)));
    onSaved(existing ? 'تم تحديث الزيارة' : 'تم تسجيل الزيارة · \u2066+' + ws.settings.xpVisit + ' XP\u2069');
  };

  const remove = () =>
    confirm('حذف هذه الزيارة من السجل؟', () => {
      apply((current) => deleteVisit(current, existing!.id));
      deletePhotoFiles([...(existing!.before ?? []), ...(existing!.after ?? []), ...before, ...after]);
      onSaved('تم حذف الزيارة');
    });

  return (
    <Sheet
      visible
      onClose={dismiss}
      title={gear ? (place?.name ?? 'زيارة معدة') : existing ? 'تعديل الزيارة' : equipment ? 'زيارة معدات التوزيع' : place ? 'زيارة ' + PLACE_NOUN[place.kind] : target.planItem ? 'تسجيل زيارة مجدولة' : 'إضافة زيارة'}
      sub={(gear ? (existing ? (existing.closedAt ? 'مقفلة' : 'مفتوحة') : 'معدة') : place ? place.name : department!.name) + ' · ' + formatDate(date, { weekday: true })}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="visit-save" style={{ flex: 1, backgroundColor: KIND.visit.solid }} icon="check" label={existing ? 'حفظ التعديل' : free ? 'حفظ الزيارة · \u2066+' + ws.settings.xpVisit + ' XP\u2069' : people.length ? 'حفظ زيارة ' + people.length + ' · \u2066+' + ws.settings.xpVisit + ' XP\u2069' : 'حدد الفنيين'} onPress={save} disabled={!free && !people.length} />
            {existing ? <Button variant="danger" label="حذف" onPress={remove} /> : null}
          </Row>
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: KIND.visit.bg, borderRadius: 14, padding: 10, marginBottom: 14 }}>
        <Icon name="map-pin" size={18} color={KIND.visit.fg} />
        <T style={{ flex: 1, color: KIND.visit.fg, fontWeight: '700' }}>{existing ? 'تعدّل زيارة محفوظة' : gear ? 'أنت تسجّل زيارة معدة' : place ? 'أنت تسجّل زيارة ' + PLACE_NOUN[place.kind] : 'أنت تسجّل زيارة · ' + department!.name}</T>
      </View>
      <Spread style={{ marginBottom: 10 }}>
        <T style={{ fontWeight: '700', fontSize: 12 }}>تاريخ الزيارة</T>
        <Stepper label={formatDate(date)} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= now.date} />
      </Spread>
      <Field label="الوقت (24 ساعة)" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" maxLength={5} testID="visit-time" />
      {gear ? null : free ? (
        <Sub>{(place ? 'زيارة ' + PLACE_NOUN[place.kind] : 'زيارة معدات') + ': ما تحتاج تحدد فنيين.'}</Sub>
      ) : (
        <>
          <T style={[s2.label, { marginTop: 4, marginBottom: 6 }]}>الفنيون والفرق اللي شملتهم الزيارة</T>
          <PeoplePicker value={people} onChange={setPeople} departmentId={pickDept ?? department!.id} onDepartment={setPickDept} date={date} time={isTime(time) ? time : now.time} includeOffice={false} testPrefix="visit-tech-" noun="محدد" />
          <Sub style={{ marginTop: 8 }}>الزيارة تُحسب مرة واحدة في التقارير، وزيارة لكل فني تحدده في سجله.</Sub>
        </>
      )}
      {gear ? (
        <>
          <PhotoField testID="gear-before" title="صورة قبل" photos={before} onChange={setBefore} onError={setError} />
          <Field label="وصف الملاحظة" value={site} onChangeText={setSite} placeholder="وش لاحظت على المعدة؟" maxLength={300} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }} testID="visit-notes" />
          <LocationField label="الموقع" placeholder="مثال: حي الروضة، شارع الأمير سلطان" value={location} onChange={setLocation} coords={coords} onCoords={setCoords} mapUrl={mapUrl} onMapUrl={setMapUrl} />
          {!place ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 12 }}>
              {EQUIPMENT_KINDS.map((option) => (
                <Touch key={option} accessibilityRole="button" feedback="select" onPress={() => setLocation(location.trim() ? location : option + ' ')} style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
                  <T style={{ fontSize: 13 }}>{option}</T>
                </Touch>
              ))}
            </View>
          ) : null}
          <Field label="رقم المهمة (اختياري)" value={taskNumber} onChangeText={setTaskNumber} placeholder="رقم أمر العمل أو البلاغ" maxLength={30} testID="visit-number" />
          {existing ? (
            <View testID="gear-close" style={{ backgroundColor: existing.closedAt ? C.greenBg : C.subtle, borderRadius: 16, borderWidth: 1, borderColor: existing.closedAt ? C.greenLine : C.line, padding: 12, marginTop: 4 }}>
              <T style={{ fontWeight: '700', marginBottom: 8 }}>{existing.closedAt ? 'انقفلت ' + formatDate(existing.closedAt, { weekday: true }) : 'إقفال الملاحظة'}</T>
              <PhotoField testID="gear-after" title="صورة بعد" photos={after} onChange={setAfter} onError={setError} />
              <Field label="ملاحظة الإقفال (اختياري)" value={closeNote} onChangeText={setCloseNote} placeholder="وش انعمل؟" maxLength={200} testID="gear-close-note" />
              {existing.closedAt ? (
                <Button small variant="secondary" icon="rotate-ccw" label="إعادة فتح" onPress={reopen} />
              ) : (
                <Button testID="gear-close-save" icon="check" label="إقفال بصورة بعد" style={{ backgroundColor: C.green }} disabled={!after.length} onPress={closeIt} />
              )}
            </View>
          ) : (
            <Sub>تقدر تقفلها بعدين بصورة بعد من قائمة المعدات.</Sub>
          )}
        </>
      ) : (
        <>
      {equipment ? null : (
        <>
      <Field label="نوع المهمة" value={workType} onChangeText={setWorkType} placeholder="مثال: صيانة، تمديد كابلات" maxLength={60} testID="visit-type" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 12 }}>
        {workTypeSuggestions(ws).map((option) => {
          const on = option === workType.trim();
          return (
            <Touch
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setWorkType(on ? '' : option)}
              style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: on ? KIND.visit.solid : C.line, backgroundColor: on ? KIND.visit.bg : C.white }}
            >
              <T style={{ fontSize: 13, color: on ? KIND.visit.fg : C.ink }}>{option}</T>
            </Touch>
          );
        })}
      </View>
        </>
      )}
      <LocationField label={equipment ? 'المعدة وموقعها' : 'الموقع'} placeholder={equipment ? 'مثال: محطة توزيع 12، حي الروضة' : 'مثال: حي الروضة، شارع الأمير سلطان'} value={location} onChange={setLocation} coords={coords} onCoords={setCoords} mapUrl={mapUrl} onMapUrl={setMapUrl} />
      {equipment ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 12 }}>
          {EQUIPMENT_KINDS.map((option) => (
            <Touch key={option} accessibilityRole="button" feedback="select" onPress={() => setLocation(location.trim() ? location : option + ' ')} style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
              <T style={{ fontSize: 13 }}>{option}</T>
            </Touch>
          ))}
        </View>
      ) : null}
      <Field label="رقم المهمة (اختياري)" value={taskNumber} onChangeText={setTaskNumber} placeholder="رقم أمر العمل أو البلاغ" maxLength={30} testID="visit-number" />
      <Field label="وصف إضافي (اختياري)" value={site} onChangeText={setSite} placeholder="ملاحظة قصيرة عن الزيارة" maxLength={120} testID="visit-notes" />
        </>
      )}
    </Sheet>
  );
}
