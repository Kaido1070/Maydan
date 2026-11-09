import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { addDays, formatDate } from '../domain/dates';
import { activeTechnicians, assignForDay, getSlot, moveTechnician, periodRange, resetSlot, setDayCrew, setSlotShift, shiftName } from '../domain/shifts';
import { useApply, useStore } from '../store';
import { Button, C, Checkbox, Chip, Divider, Row, Segmented, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';

/** نقل الفني لشفت أساسي جديد، وتكليفه ليوم واحد بشكل مستقل. */
export function TechnicianShiftSheet({ technicianId, initialDate, onClose, onSaved }: { technicianId: string | null; initialDate?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const tech = ws.technicians.find((item) => item.id === technicianId);
  const department = ws.departments.find((item) => item.id === tech?.departmentId);
  const [baseShift, setBaseShift] = useState('');
  const [date, setDate] = useState(now.date);
  const [periodId, setPeriodId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tech || !department) return;
    setBaseShift(tech.baseShiftId);
    setDate(initialDate ?? now.date);
    setPeriodId(department.periods[0]?.id ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicianId]);

  if (!tech || !department) return null;
  const slot = periodId ? getSlot(ws, department, date, periodId) : null;
  const assigned = !!slot?.crew.some((item) => item.id === tech.id);

  const saveBase = () => {
    const failure = apply((current) => moveTechnician(current, tech.id, baseShift));
    if (failure) return setError(failure);
    onSaved('تم نقل ' + tech.name + ' إلى ' + department.shifts.find((shift) => shift.id === baseShift)?.name);
  };
  const toggleDay = () => {
    const failure = apply((current) => assignForDay(current, tech.id, department.id, date, periodId, !assigned));
    if (failure) return setError(failure);
    onSaved(assigned ? 'تم إلغاء تكليف ' + tech.name + ' لهذا اليوم' : 'تم تكليف ' + tech.name + ' ليوم ' + formatDate(date));
  };

  return (
    <Sheet visible onClose={onClose} title={tech.name} sub={'الرقم الوظيفي ' + tech.employeeNumber + ' · ' + department.name}>
      <T style={{ fontWeight: '800', fontSize: 16 }}>الشفت الأساسي</T>
      <Sub>يحدد دوام الفني في الدورة من الآن فصاعدًا. التكليفات اليومية المحفوظة لا تتغير.</Sub>
      <View style={{ marginVertical: 10 }}>
        <Segmented wrap options={department.shifts.map((shift) => ({ value: shift.id, label: shift.name }))} value={baseShift} onChange={setBaseShift} />
      </View>
      <Button testID="move-save" label={baseShift === tech.baseShiftId ? 'الشفت الحالي: ' + shiftName(ws, tech) : 'نقل إلى ' + department.shifts.find((s) => s.id === baseShift)?.name} disabled={baseShift === tech.baseShiftId} onPress={saveBase} />

      <View style={{ height: 22 }} />
      <Divider />
      <View style={{ height: 14 }} />
      <T style={{ fontWeight: '800', fontSize: 16 }}>تكليف ليوم واحد</T>
      <Sub>يضيف الفني لشفت تاريخ وفترة محددة فقط، بدون تغيير شفته الأساسي.</Sub>
      <Spread style={{ marginTop: 10 }}>
        <T style={{ fontSize: 12, fontWeight: '700' }}>التاريخ</T>
        <Stepper label={formatDate(date, { weekday: true })} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />
      </Spread>
      {department.periods.length > 1 ? (
        <View style={{ marginTop: 10 }}>
          <Segmented options={department.periods.map((period) => ({ value: period.id, label: period.name }))} value={periodId} onChange={setPeriodId} />
        </View>
      ) : null}
      <Card2>
        {slot?.shift ? (
          <>
            <T style={{ fontWeight: '700' }}>{slot.shift.name + ' · ' + slot.period.name}</T>
            <Sub>{periodRange(slot.period) + ' · ' + slot.crew.length + ' فني'}</Sub>
            <Row style={{ marginTop: 6, flexWrap: 'wrap' }} gap={4}>
              <Chip tone={assigned ? 'green' : 'neutral'} label={assigned ? 'مكلف في هذا الشفت' : 'غير مكلف'} />
              {slot.dayAssigned ? <Chip tone="amber" label="قائمة اليوم معدلة" /> : null}
            </Row>
          </>
        ) : (
          <Sub>ما فيه شفت للقسم في هذا التاريخ والفترة.</Sub>
        )}
      </Card2>
      <Button testID="day-assign" variant={assigned ? 'danger' : 'secondary'} disabled={!slot?.shift} label={assigned ? 'إلغاء التكليف لهذا اليوم' : 'تكليفه لهذا اليوم'} onPress={toggleDay} />
      {error ? <T style={{ color: C.red, marginTop: 8 }}>{error}</T> : null}
    </Sheet>
  );
}

const Card2 = ({ children }: { children: React.ReactNode }) => (
  <View style={{ backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, marginVertical: 10 }}>{children}</View>
);

export type SlotTarget = { departmentId: string; date: string; periodId: string } | null;

/** تعديل شفت يوم في الجدول: تبديل الشفت وتحديد فنيي هذا اليوم. */
export function SlotSheet({ target, onClose, onSaved }: { target: SlotTarget; onClose: () => void; onSaved: (message: string) => void }) {
  const { ws } = useStore();
  const apply = useApply();
  const department = ws.departments.find((item) => item.id === target?.departmentId);
  const [shiftId, setShiftId] = useState<string>('');
  const [people, setPeople] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const slot = department && target ? getSlot(ws, department, target.date, target.periodId) : null;
  useEffect(() => {
    if (!slot) return;
    setShiftId(slot.shift?.id ?? '');
    setPeople(slot.crew.map((tech) => tech.id));
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target || !department || !slot) return null;
  const techs = activeTechnicians(ws).filter((tech) => tech.departmentId === department.id);

  const chooseShift = (value: string) => {
    setShiftId(value);
    if (!touched) setPeople(techs.filter((tech) => tech.baseShiftId === value).map((tech) => tech.id));
  };

  const save = () => {
    const failure = apply((current) => {
      let next = setSlotShift(current, department.id, target.date, target.periodId, shiftId || null);
      if (shiftId && touched) next = setDayCrew(next, department.id, target.date, target.periodId, people);
      return next;
    });
    if (failure) return;
    onSaved('تم حفظ شفت ' + department.name + ' ليوم ' + formatDate(target.date));
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={'شفت ' + department.name}
      sub={formatDate(target.date, { weekday: true }) + ' · ' + slot.period.name + ' · ' + periodRange(slot.period)}
      footer={
        <Row>
          <Button testID="slot-save" style={{ flex: 1 }} label="حفظ توزيع اليوم" onPress={save} />
          {slot.shiftChanged || slot.dayAssigned ? (
            <Button
              variant="secondary"
              label="استعادة الدورة"
              onPress={() => {
                apply((current) => resetSlot(current, department.id, target.date, target.periodId));
                onSaved('تمت استعادة دورة الشفت');
              }}
            />
          ) : null}
        </Row>
      }
    >
      <T style={{ fontWeight: '700', marginBottom: 6 }}>الشفت في هذا اليوم</T>
      <Segmented wrap options={[{ value: '', label: 'بدون شفت' }, ...department.shifts.map((shift) => ({ value: shift.id, label: shift.name }))]} value={shiftId} onChange={chooseShift} />
      {shiftId ? (
        <>
          <T style={{ fontWeight: '700', marginTop: 16 }}>تكليف اليوم</T>
          <Sub>يخص هذا التاريخ والفترة فقط. لتغيير الشفت الأساسي افتح الفني من شاشة اليوم أو الشفتات.</Sub>
          {techs.map((tech) => (
            <Row key={tech.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line, marginTop: 4 }}>
              <Checkbox
                checked={people.includes(tech.id)}
                label={tech.name}
                onChange={(value) => {
                  setTouched(true);
                  setPeople((list) => (value ? [...list, tech.id] : list.filter((id) => id !== tech.id)));
                }}
              />
              <View style={{ flex: 1 }}>
                <T>{tech.name}</T>
              </View>
              <Chip tone={tech.baseShiftId === shiftId ? 'purple' : 'neutral'} label={'الأساسي: ' + shiftName(ws, tech)} />
            </Row>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}
