import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { addDays, formatDate, isTime } from '../domain/dates';
import { PLACE_NOUN, PLACE_WORK_TYPE } from '../domain/places';
import { addVisit, deleteVisit, updateVisit, validateVisit, workTypeSuggestions } from '../domain/records';
import { activeTechnicians, shiftName, slotAt, techTag } from '../domain/shifts';
import type { PlanItem } from '../domain/types';
import { useApply, useStore } from '../store';
import { Button, C, Checkbox, Chip, Field, KIND, Row, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';

export type VisitTarget = { departmentId: string; visitId?: string; planItem?: PlanItem; date?: string; technicianIds?: string[]; placeId?: string } | null;

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

  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [site, setSite] = useState('');
  const [workType, setWorkType] = useState('');
  const [location, setLocation] = useState('');
  const [taskNumber, setTaskNumber] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    if (existing) {
      setDate(existing.date);
      setTime(existing.time);
      setSite(existing.workType || existing.location || existing.taskNumber ? existing.site : '');
      setWorkType(existing.workType ?? '');
      // الزيارات القديمة: الموقع كان في حقل الوصف
      setLocation(existing.location ?? (existing.workType || existing.taskNumber ? '' : existing.site));
      setTaskNumber(existing.taskNumber ?? '');
      setPeople(existing.technicianIds);
    } else {
      const date = target.date ?? now.date;
      const time = target.planItem?.time ?? now.time;
      setDate(date);
      setTime(time);
      setSite('');
      setWorkType(place ? PLACE_WORK_TYPE[place.kind] : target.planItem?.title ?? '');
      setLocation(place ? place.name : '');
      setTaskNumber('');
      const slot = department && isTime(time) ? slotAt(ws, department, date, time) : null;
      setPeople(target.technicianIds ?? (target.planItem ? (slot?.crew ?? []).map((tech) => tech.id) : []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const { onShift, others } = useMemo(() => {
    if (!department) return { onShift: [], others: [] };
    const slot = isTime(time) ? slotAt(ws, department, date, time) : null;
    const shiftIds = new Set((slot?.crew ?? []).map((tech) => tech.id));
    const pool = activeTechnicians(ws).filter((tech) => tech.departmentId === department.id || shiftIds.has(tech.id) || people.includes(tech.id));
    return { onShift: pool.filter((tech) => shiftIds.has(tech.id)), others: pool.filter((tech) => !shiftIds.has(tech.id)) };
  }, [ws, department, date, time, people]);

  if (!target || (!department && !place)) return null;

  const toggle = (id: string, value: boolean) => setPeople((list) => (value ? [...list, id] : list.filter((item) => item !== id)));
  const input = { departmentId: department?.id ?? '', placeId: place?.id, date, time, workType, location, taskNumber, site, technicianIds: people, planItemId: existing?.planItemId ?? target.planItem?.id };

  const save = () => {
    const problem = validateVisit(ws, input, now.date);
    if (problem) return setError(problem);
    const failure = apply((current) => (existing ? updateVisit(current, existing.id, input, now.date) : addVisit(current, input, now.date).ws));
    if (failure) return setError(failure);
    onSaved(existing ? 'تم تحديث الزيارة' : 'تم تسجيل الزيارة · \u2066+' + ws.settings.xpVisit + ' XP\u2069');
  };

  const remove = () =>
    confirm('حذف هذه الزيارة من السجل؟', () => {
      apply((current) => deleteVisit(current, existing!.id));
      onSaved('تم حذف الزيارة');
    });

  const list = (title: string, techs: typeof onShift) =>
    techs.length ? (
      <View style={{ marginTop: 6 }}>
        <Sub style={{ fontWeight: '700', marginBottom: 4 }}>{title}</Sub>
        {techs.map((tech) => (
          <Row key={tech.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            <Checkbox testID={'visit-tech-' + tech.id} checked={people.includes(tech.id)} onChange={(value) => toggle(tech.id, value)} label={tech.name} />
            <View style={{ flex: 1 }}>
              <T>{tech.name}</T>
              <Sub>{techTag(tech) + ' · ' + shiftName(ws, tech)}</Sub>
            </View>
          </Row>
        ))}
      </View>
    ) : null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={existing ? 'تعديل الزيارة' : place ? 'زيارة ' + PLACE_NOUN[place.kind] : target.planItem ? 'تسجيل زيارة مجدولة' : 'إضافة زيارة'}
      sub={(place ? place.name : department!.name) + ' · ' + formatDate(date, { weekday: true })}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="visit-save" style={{ flex: 1 }} label={existing ? 'حفظ التعديل' : 'حفظ الزيارة · \u2066+' + ws.settings.xpVisit + ' XP\u2069'} onPress={save} disabled={!place && !people.length} />
            {existing ? <Button variant="danger" label="حذف" onPress={remove} /> : null}
          </Row>
        </>
      }
    >
      <Spread style={{ marginBottom: 10 }}>
        <T style={{ fontWeight: '700', fontSize: 12 }}>تاريخ الزيارة</T>
        <Stepper label={formatDate(date)} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= now.date} />
      </Spread>
      <Field label="الوقت (24 ساعة)" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" maxLength={5} testID="visit-time" />
      <Field label="نوع المهمة" value={workType} onChangeText={setWorkType} placeholder="مثال: صيانة، تمديد كابلات" maxLength={60} testID="visit-type" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 12 }}>
        {workTypeSuggestions(ws).map((option) => {
          const on = option === workType.trim();
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setWorkType(on ? '' : option)}
              style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: on ? KIND.visit.solid : C.line, backgroundColor: on ? KIND.visit.bg : C.white }}
            >
              <T style={{ fontSize: 13, color: on ? KIND.visit.fg : C.ink }}>{option}</T>
            </Pressable>
          );
        })}
      </View>
      <Field label="الموقع" value={location} onChangeText={setLocation} placeholder="مثال: حي الروضة، شارع الأمير سلطان" maxLength={100} testID="visit-site" />
      <Field label="رقم المهمة (اختياري)" value={taskNumber} onChangeText={setTaskNumber} placeholder="رقم أمر العمل أو البلاغ" maxLength={30} testID="visit-number" />
      <Field label="وصف إضافي (اختياري)" value={site} onChangeText={setSite} placeholder="ملاحظة قصيرة عن الزيارة" maxLength={120} testID="visit-notes" />
      {place ? (
        <Sub>{'زيارة ' + PLACE_NOUN[place.kind] + ': ما تحتاج تحدد فنيين.'}</Sub>
      ) : (
        <>
          <Spread>
            <T style={{ fontWeight: '700', fontSize: 12 }}>الفنيون والفرق الذين شملتهم الزيارة</T>
            <Chip tone={people.length ? 'green' : 'neutral'} label={people.length + ' محدد'} />
          </Spread>
          <Sub>الزيارة تُحسب مرة واحدة في التقارير، وزيارة لكل فني تحدده في سجله.</Sub>
          {list('على رأس العمل وقت الزيارة', onShift)}
          {list('بقية فنيي ' + department!.name, others)}
          {!onShift.length && !others.length ? <Sub style={{ marginTop: 10 }}>ما فيه فنيون في هذا القسم. أضفهم من الإعدادات.</Sub> : null}
        </>
      )}
    </Sheet>
  );
}
