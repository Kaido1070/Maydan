import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { addDays, formatDate, isDateKey, isTime, WEEKDAYS_AR } from '../domain/dates';
import { addPlanItem, removeTechnician, updateDepartment, upsertTechnician } from '../domain/plan';
import { newId } from '../domain/records';
import { deptEntryKind, ENTRY_NOUN, OFF } from '../domain/shifts';
import type { Department, EntryKind, PlanItem, Rotation } from '../domain/types';
import { useApply, useStore } from '../store';
import { Button, C, Divider, Field, Icon, Row, Segmented, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';
import { confirm } from './VisitSheet';
import { Touch } from '../ui/touch';

/* ───────────── تعديل القسم: الشفتات وأوقات الدوام وبداية الدورة ───────────── */

export function DepartmentSheet({ departmentId, onClose, onSaved }: { departmentId: string | null; onClose: () => void; onSaved: (m: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const [draft, setDraft] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const department = ws.departments.find((item) => item.id === departmentId);
    setDraft(department ? JSON.parse(JSON.stringify(department)) : null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  if (!departmentId || !draft) return null;
  const set = (patch: Partial<Department>) => setDraft({ ...draft, ...patch });
  const rotation = draft.rotation;
  const setRotation = (next: Rotation) => set({ rotation: next });
  const cycleValues = [...draft.periods.map((p) => p.id), OFF];
  const periodName = (id: string) => (id === OFF ? 'راحة' : draft.periods.find((p) => p.id === id)?.name ?? id);

  const save = () => {
    for (const period of draft.periods) {
      if (!isTime(period.start) || !isTime(period.end)) return setError('اكتب أوقات الدوام بصيغة 24 ساعة مثل 07:00');
      if (!period.name.trim()) return setError('اكتب اسم كل فترة');
    }
    if (rotation.kind === 'cycle' && !isDateKey(rotation.anchorDate)) return setError('تاريخ بداية الدورة غير صحيح');
    if (rotation.kind === 'weekly' && !rotation.workDays.length) return setError('حدد يوم عمل واحدًا على الأقل');
    const failure = apply((current) => updateDepartment(current, draft));
    if (failure) return setError(failure);
    onSaved('تم حفظ إعدادات ' + draft.name);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={'إعداد ' + draft.name}
      sub="الشفتات، أوقات الدوام، ودورة العمل"
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Button testID="dept-save" label="حفظ القسم" onPress={save} />
        </>
      }
    >
      <Field label="اسم القسم" value={draft.name} onChangeText={(name) => set({ name })} />
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>السجلات في هذا القسم</T>
      <Segmented
        options={[
          { value: 'person', label: 'فنيون وفرق' },
          { value: 'project', label: 'مشاريع' },
        ]}
        value={draft.entryKind ?? 'person'}
        onChange={(entryKind) => set({ entryKind })}
      />
      <Sub style={{ marginTop: 4, marginBottom: 10 }}>يحدد النوع الافتراضي عند الإضافة والاستيراد. الإنشاءات غالبًا مشاريع.</Sub>

      <Spread style={{ marginTop: 6 }}>
        <T style={{ fontWeight: '800' }}>الشفتات</T>
        <Button small variant="secondary" icon="plus" label="شفت" onPress={() => set({ shifts: [...draft.shifts, { id: newId('s'), name: draft.name + ' ' + (draft.shifts.length + 1) }] })} />
      </Spread>
      {draft.shifts.map((shift, index) => {
        const used = ws.technicians.some((tech) => tech.baseShiftId === shift.id);
        return (
          <Row key={shift.id} style={{ marginTop: 6, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label={'الشفت ' + (index + 1)} value={shift.name} onChangeText={(name) => set({ shifts: draft.shifts.map((s) => (s.id === shift.id ? { ...s, name } : s)) })} />
            </View>
            <Button
              small
              variant="danger"
              label="حذف"
              disabled={used || draft.shifts.length < 2}
              onPress={() => set({ shifts: draft.shifts.filter((s) => s.id !== shift.id) })}
              style={{ marginBottom: 10 }}
            />
          </Row>
        );
      })}
      <Sub>ما يمكن حذف شفت فيه فنيون. انقلهم أولًا.</Sub>

      <View style={{ height: 14 }} />
      <Divider />
      <Spread style={{ marginTop: 12 }}>
        <T style={{ fontWeight: '800' }}>فترات وأوقات الدوام</T>
        <Button
          small
          variant="secondary"
          icon="plus"
          label="فترة"
          onPress={() => set({ periods: [...draft.periods, { id: newId('p'), name: 'فترة ' + (draft.periods.length + 1), start: '07:00', end: '15:00' }] })}
        />
      </Spread>
      <Sub>{'إذا كان وقت النهاية قبل البداية تمتد الفترة لليوم التالي (مثل \u206619:00 – 07:00\u2069).'}</Sub>
      {draft.periods.map((period) => (
        <View key={period.id} style={{ marginTop: 8, padding: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line }}>
          <Field label="اسم الفترة" value={period.name} onChangeText={(name) => set({ periods: draft.periods.map((p) => (p.id === period.id ? { ...p, name } : p)) })} />
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="من" value={period.start} maxLength={5} keyboardType="numbers-and-punctuation" testID={'period-start-' + period.id} onChangeText={(start) => set({ periods: draft.periods.map((p) => (p.id === period.id ? { ...p, start } : p)) })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="إلى" value={period.end} maxLength={5} keyboardType="numbers-and-punctuation" testID={'period-end-' + period.id} onChangeText={(end) => set({ periods: draft.periods.map((p) => (p.id === period.id ? { ...p, end } : p)) })} />
            </View>
          </Row>
          {draft.periods.length > 1 ? (
            <Button
              small
              variant="danger"
              label="حذف الفترة"
              onPress={() =>
                set({
                  periods: draft.periods.filter((p) => p.id !== period.id),
                  rotation: rotation.kind === 'cycle' ? { ...rotation, pattern: rotation.pattern.map((v) => (v === period.id ? OFF : v)) } : rotation,
                })
              }
            />
          ) : null}
        </View>
      ))}

      <View style={{ height: 14 }} />
      <Divider />
      <T style={{ fontWeight: '800', marginTop: 12, marginBottom: 6 }}>دورة الشفتات</T>
      <Segmented
        options={[
          { value: 'cycle', label: 'دورة متكررة' },
          { value: 'weekly', label: 'أيام أسبوع ثابتة' },
        ]}
        value={rotation.kind}
        onChange={(kind) =>
          setRotation(
            kind === 'weekly'
              ? { kind: 'weekly', workDays: [0, 1, 2, 3, 4] }
              : { kind: 'cycle', anchorDate: now.date, pattern: [draft.periods[0].id, draft.periods[0].id, OFF, OFF], staggerDays: 2 },
          )
        }
      />
      {rotation.kind === 'weekly' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {WEEKDAYS_AR.map((name, day) => {
            const on = rotation.workDays.includes(day);
            return (
              <Touch
                key={day}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setRotation({ ...rotation, workDays: on ? rotation.workDays.filter((d) => d !== day) : [...rotation.workDays, day].sort() })}
                style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: on ? C.brand : C.white, borderWidth: 1, borderColor: on ? C.brand : C.line }}
              >
                <T style={{ color: on ? C.onAccent : C.ink, fontSize: 12 }}>{name}</T>
              </Touch>
            );
          })}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Spread>
            <T style={{ fontSize: 12, fontWeight: '700' }}>بداية الدورة</T>
            <Stepper
              label={formatDate(rotation.anchorDate, { year: true })}
              onPrev={() => setRotation({ ...rotation, anchorDate: addDays(rotation.anchorDate, -1) })}
              onNext={() => setRotation({ ...rotation, anchorDate: addDays(rotation.anchorDate, 1) })}
            />
          </Spread>
          <Sub style={{ marginTop: 4 }}>{'في هذا التاريخ يكون «' + draft.shifts[0]?.name + '» في اليوم الأول من النمط.'}</Sub>
          <T style={{ fontSize: 12, fontWeight: '700', marginTop: 10 }}>نمط الأيام (اضغط اليوم لتغييره)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {rotation.pattern.map((value, index) => (
              <Touch
                key={index}
                accessibilityRole="button"
                accessibilityLabel={'اليوم ' + (index + 1) + ': ' + periodName(value)}
                onPress={() => {
                  const next = cycleValues[(cycleValues.indexOf(value) + 1) % cycleValues.length];
                  setRotation({ ...rotation, pattern: rotation.pattern.map((v, i) => (i === index ? next : v)) });
                }}
                style={{ width: 62, padding: 6, borderRadius: 9, alignItems: 'center', backgroundColor: value === OFF ? C.track : C.soft }}
              >
                <Sub style={{ fontSize: 10 }}>{'يوم ' + (index + 1)}</Sub>
                <T style={{ fontSize: 12, fontWeight: '700', color: value === OFF ? C.muted : C.link }}>{periodName(value)}</T>
              </Touch>
            ))}
          </View>
          <Row style={{ marginTop: 8 }}>
            <Button small variant="secondary" icon="plus" label="يوم" onPress={() => setRotation({ ...rotation, pattern: [...rotation.pattern, OFF] })} />
            <Button small variant="secondary" icon="minus" label="يوم" disabled={rotation.pattern.length < 2} onPress={() => setRotation({ ...rotation, pattern: rotation.pattern.slice(0, -1) })} />
          </Row>
          <Spread style={{ marginTop: 10 }}>
            <T style={{ fontSize: 12, fontWeight: '700' }}>تأخر كل شفت عن السابق (أيام)</T>
            <Stepper
              label={String(rotation.staggerDays)}
              onPrev={() => setRotation({ ...rotation, staggerDays: Math.max(0, rotation.staggerDays - 1) })}
              onNext={() => setRotation({ ...rotation, staggerDays: rotation.staggerDays + 1 })}
            />
          </Spread>
        </View>
      )}
    </Sheet>
  );
}

/* ───────────── إضافة/تعديل فني ───────────── */

export function TechnicianEditSheet({ technicianId, onClose, onSaved }: { technicianId: string | 'new' | null; onClose: () => void; onSaved: (m: string) => void }) {
  const { ws } = useStore();
  const apply = useApply();
  const existing = ws.technicians.find((tech) => tech.id === technicianId);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [kind, setKind] = useState<EntryKind>('person');
  const [contractor, setContractor] = useState('');
  const [workplace, setWorkplace] = useState<'field' | 'office'>('field');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!technicianId) return;
    setKind(existing?.kind ?? deptEntryKind(ws.departments.find((d) => d.id === (existing?.departmentId ?? ws.departments[0]?.id))));
    setContractor(existing?.contractor ?? '');
    setWorkplace(existing?.workplace ?? 'field');
    const first = ws.departments[0];
    setName(existing?.name ?? '');
    setNumber(existing?.employeeNumber ?? '');
    setDepartmentId(existing?.departmentId ?? first?.id ?? '');
    setShiftId(existing?.baseShiftId ?? first?.shifts[0]?.id ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicianId]);

  if (!technicianId) return null;
  const department = ws.departments.find((d) => d.id === departmentId);

  const save = () => {
    const failure = apply((current) =>
      upsertTechnician(current, { id: existing?.id, name, employeeNumber: number, kind, contractor, workplace: kind === 'person' && workplace === 'office' ? 'office' : undefined, departmentId, baseShiftId: shiftId, active: existing?.active ?? true }),
    );
    if (failure) return setError(failure);
    onSaved(existing ? 'تم تحديث البيانات' : 'تمت إضافة ' + ENTRY_NOUN[kind]);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={existing ? 'تعديل' : 'إضافة فني أو فريق أو مشروع'}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="tech-save" style={{ flex: 1 }} label="حفظ" onPress={save} />
            {existing ? (
              <Button
                variant="danger"
                label={existing.active === false ? 'تفعيل' : 'حذف'}
                onPress={() =>
                  existing.active === false
                    ? (apply((c) => ({ ...c, technicians: c.technicians.map((t) => (t.id === existing.id ? { ...t, active: true } : t)) })), onSaved('تم تفعيل الفني'))
                    : confirm('حذف ' + existing.name + '؟ إذا كان له سجلات سيتم تعطيله فقط.', () => {
                        apply((c) => removeTechnician(c, existing.id));
                        onSaved('تم حذف الفني');
                      })
                }
              />
            ) : null}
          </Row>
        </>
      }
    >
      <Segmented
        options={[
          { value: 'person', label: 'فني' },
          { value: 'team', label: 'فريق / مقاول' },
          { value: 'project', label: 'مشروع' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Sub style={{ marginVertical: 8 }}>
        {kind === 'project'
          ? 'للإنشاءات: سجّل المشروع باسمه، ومعه المقاول ورقم المشروع إن وجد. يُحسب له هدف الزيارات والاجتماعات.'
          : kind === 'team'
            ? 'للصيانة وغيرها: سجّل الفريق باسمه أو باسم المقاول. يُحسب له هدف الزيارات والاجتماعات مثل الفني.'
            : 'فني باسمه ورقمه الوظيفي.'}
      </Sub>
      <Field
        label={kind === 'project' ? 'اسم المشروع' : kind === 'team' ? 'اسم الفريق' : 'اسم الفني'}
        value={name}
        onChangeText={setName}
        testID="tech-name"
        placeholder={kind === 'project' ? 'مثال: مشروع شبكة حي الروضة' : kind === 'team' ? 'مثال: فريق الحفريات 1' : ''}
      />
      {kind === 'person' ? (
        <View style={{ marginBottom: 10 }}>
          <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>طبيعة العمل</T>
          <Segmented
            options={[
              { value: 'field', label: 'ميداني' },
              { value: 'office', label: 'مكتبي' },
            ]}
            value={workplace}
            onChange={setWorkplace}
          />
          <Sub style={{ marginTop: 4 }}>{workplace === 'office' ? 'المكتبي يحضر الاجتماعات وتوصله الرسالة، بدون هدف زيارات ميدانية.' : 'الميداني له هدف زيارات واجتماعات.'}</Sub>
        </View>
      ) : null}
      {kind !== 'person' ? <Field label="اسم المقاول (اختياري)" value={contractor} onChangeText={setContractor} testID="tech-contractor" /> : null}
      <Field
        label={kind === 'project' ? 'رقم المشروع (اختياري)' : kind === 'team' ? 'رقم الفريق أو العقد (اختياري)' : 'الرقم الوظيفي'}
        value={number}
        onChangeText={setNumber}
        keyboardType={kind === 'person' ? 'number-pad' : 'default'}
        testID="tech-number"
      />
      <T style={{ fontWeight: '700', fontSize: 12, marginBottom: 6 }}>القسم</T>
      <Segmented
        wrap
        options={ws.departments.map((d) => ({ value: d.id, label: d.name }))}
        value={departmentId}
        onChange={(id) => {
          setDepartmentId(id);
          setShiftId(ws.departments.find((d) => d.id === id)?.shifts[0]?.id ?? '');
          if (!existing) setKind(deptEntryKind(ws.departments.find((d) => d.id === id)));
        }}
      />
      <T style={{ fontWeight: '700', fontSize: 12, marginVertical: 6 }}>الشفت الأساسي</T>
      {department ? <Segmented wrap options={department.shifts.map((s) => ({ value: s.id, label: s.name }))} value={shiftId} onChange={setShiftId} /> : null}
    </Sheet>
  );
}

/* ───────────── إضافة مهمة للخطة الأسبوعية ───────────── */

export function PlanItemSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const year = Number(now.date.slice(0, 4));
  const [item, setItem] = useState<Omit<PlanItem, 'id'>>({ weekday: 0, departmentId: '', time: '08:00', title: '', kind: 'visit' });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setItem({ weekday: 0, departmentId: ws.departments[0]?.id ?? '', time: '08:00', title: '', kind: 'visit' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (!visible) return null;
  const meetings = ws.meetings.filter((m) => m.year === year);
  const save = () => {
    if (!isTime(item.time)) return setError('اكتب الوقت بصيغة 24 ساعة مثل 08:30');
    const failure = apply((c) => addPlanItem(c, item));
    if (failure) return setError(failure);
    onSaved('تمت إضافة المهمة للخطة');
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="مهمة أسبوعية"
      sub="تظهر في «مهام اليوم» في اليوم المحدد كل أسبوع"
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Button label="إضافة" onPress={save} />
        </>
      }
    >
      <Segmented
        options={[
          { value: 'visit', label: 'زيارة' },
          { value: 'meeting', label: 'اجتماع' },
        ]}
        value={item.kind}
        onChange={(kind) => setItem({ ...item, kind, meetingId: kind === 'meeting' ? meetings[0]?.id : undefined, title: kind === 'meeting' ? meetings[0]?.title ?? '' : item.title })}
      />
      <T style={{ fontWeight: '700', fontSize: 12, marginVertical: 6 }}>اليوم</T>
      <Segmented wrap options={WEEKDAYS_AR.map((label, value) => ({ value, label }))} value={item.weekday} onChange={(weekday) => setItem({ ...item, weekday })} />
      <T style={{ fontWeight: '700', fontSize: 12, marginVertical: 6 }}>القسم</T>
      <Segmented wrap options={ws.departments.map((d) => ({ value: d.id, label: d.name }))} value={item.departmentId} onChange={(departmentId) => setItem({ ...item, departmentId })} />
      <View style={{ height: 10 }} />
      <Field label="الوقت" value={item.time} onChangeText={(time) => setItem({ ...item, time })} maxLength={5} keyboardType="numbers-and-punctuation" />
      {item.kind === 'meeting' ? (
        meetings.length ? (
          <>
            <T style={{ fontWeight: '700', fontSize: 12, marginBottom: 6 }}>الاجتماع</T>
            <Segmented wrap options={meetings.map((m) => ({ value: m.id, label: m.title }))} value={item.meetingId ?? ''} onChange={(meetingId) => setItem({ ...item, meetingId, title: meetings.find((m) => m.id === meetingId)?.title ?? '' })} />
          </>
        ) : (
          <Sub>أضف عنوان اجتماع من شاشة الاجتماعات أولًا.</Sub>
        )
      ) : (
        <Field label="عنوان الزيارة" value={item.title} onChangeText={(title) => setItem({ ...item, title })} placeholder="مثال: فحص معدات الوقاية" />
      )}
    </Sheet>
  );
}

export function IconLine({ icon, text }: { icon: React.ComponentProps<typeof Icon>['name']; text: string }) {
  return (
    <Row style={{ marginTop: 6 }}>
      <Icon name={icon} size={14} color={C.muted} />
      <Sub style={{ flex: 1 }}>{text}</Sub>
    </Row>
  );
}
