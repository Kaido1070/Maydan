import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { normalizeDigits } from '../domain/dates';
import { currentSlot, shiftName, slotAt, techTag } from '../domain/shifts';
import { searchTechnicians } from '../domain/stats';
import type { Technician } from '../domain/types';
import { useStore } from '../store';
import { Button, C, Checkbox, Icon, Row, s, Spread, Sub, T } from './kit';
import { Touch } from './touch';

/**
 * اختيار الأشخاص في صفحة التسجيل: بحث بالاسم أو الرقم الوظيفي في كل الأقسام،
 * واقتراح شفت القسم وقت التسجيل، والمختارون يطلعون فوق عشان ما ينسى أحد.
 */
export function PeoplePicker({
  value,
  onChange,
  departmentId,
  onDepartment,
  date,
  time,
  includeOffice,
  testPrefix,
  noun = 'محدد',
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** القسم اللي نقترح شفته. */
  departmentId: string | null;
  onDepartment: (id: string) => void;
  date: string;
  time: string;
  /** الاجتماعات تشمل الموظفين المكتبيين، الزيارات لا. */
  includeOffice: boolean;
  testPrefix: string;
  noun?: string;
}) {
  const { ws, now } = useStore();
  const [query, setQuery] = useState('');
  const allowed = (tech: Technician) => tech.active !== false && (includeOffice || tech.workplace !== 'office' || value.includes(tech.id));
  const department = ws.departments.find((item) => item.id === departmentId);
  const slot = department ? (date === now.date ? currentSlot(ws, department, { date, time }) : slotAt(ws, department, date, time)) : null;
  const shiftIds = new Set((slot?.crew ?? []).map((tech) => tech.id));
  const pool = ws.technicians.filter(allowed);
  const onShift = pool.filter((tech) => shiftIds.has(tech.id));
  const rest = pool.filter((tech) => tech.departmentId === departmentId && !shiftIds.has(tech.id));
  const results = query.trim() ? searchTechnicians(ws, normalizeDigits(query)).filter(allowed) : null;
  const chosen = value.map((id) => ws.technicians.find((tech) => tech.id === id)).filter((tech): tech is Technician => !!tech);
  const toggle = (id: string, on: boolean) => onChange(on ? [...value.filter((item) => item !== id), id] : value.filter((item) => item !== id));
  const deptName = (id: string) => ws.departments.find((item) => item.id === id)?.name ?? '';

  const row = (tech: Technician) => {
    const on = value.includes(tech.id);
    return (
      <Touch
        key={tech.id}
        accessibilityRole="button"
        accessibilityLabel={tech.name}
        scaleTo={0.985}
        onPress={() => toggle(tech.id, !on)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}
      >
        <Checkbox testID={testPrefix + tech.id} checked={on} onChange={(checked) => toggle(tech.id, checked)} label={tech.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={{ fontWeight: on ? '700' : '500' }}>{tech.name}</T>
          <Sub numberOfLines={1}>{[techTag(tech), deptName(tech.departmentId), tech.workplace === 'office' ? 'مكتبي' : shiftName(ws, tech)].filter(Boolean).join(' · ')}</Sub>
        </View>
      </Touch>
    );
  };
  const group = (title: string, people: Technician[]) =>
    people.length ? (
      <View style={{ marginTop: 10 }}>
        <Spread style={{ marginBottom: 2 }}>
          <Sub style={{ fontWeight: '700' }}>{title + ' · ' + people.length}</Sub>
          <Button
            small
            variant="ghost"
            label={people.every((tech) => value.includes(tech.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
            onPress={() => {
              const ids = people.map((tech) => tech.id);
              const all = ids.every((id) => value.includes(id));
              onChange(all ? value.filter((id) => !ids.includes(id)) : [...new Set([...value, ...ids])]);
            }}
          />
        </Spread>
        {people.map(row)}
      </View>
    ) : null;

  return (
    <View>
      <View testID="people-chosen" style={{ backgroundColor: chosen.length ? C.greenBg : C.subtle, borderRadius: 14, borderWidth: 1, borderColor: chosen.length ? C.greenLine : C.line, padding: 10, marginBottom: 10 }}>
        <T style={{ fontWeight: '700', color: chosen.length ? C.green : C.muted }}>{chosen.length ? chosen.length + ' ' + noun : 'ما حددت أحد للحين'}</T>
        {chosen.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {chosen.map((tech) => (
              <Touch
                key={tech.id}
                accessibilityRole="button"
                accessibilityLabel={'إزالة ' + tech.name}
                feedback="select"
                onPress={() => toggle(tech.id, false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.white, borderRadius: 99, borderWidth: 1, borderColor: C.greenLine, paddingVertical: 4, paddingHorizontal: 10 }}
              >
                <T style={{ fontSize: 13, fontWeight: '600' }}>{tech.name}</T>
                <Icon name="x" size={13} color={C.muted} />
              </Touch>
            ))}
          </Row>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            testID="people-search"
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث بالاسم أو الرقم الوظيفي"
            placeholderTextColor={C.placeholder}
            returnKeyType="search"
            style={s.input}
          />
        </View>
        {query ? <Button small variant="secondary" label="مسح" onPress={() => setQuery('')} /> : null}
      </View>

      {results ? (
        <View style={{ marginTop: 8 }}>
          {results.length ? results.map(row) : <Sub style={{ paddingVertical: 14, textAlign: 'center' }}>ما لقيت أحد بهالاسم أو الرقم.</Sub>}
        </View>
      ) : (
        <>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {ws.departments.map((item) => {
              const active = item.id === departmentId;
              return (
                <Touch
                  key={item.id}
                  testID={testPrefix + 'dept-' + item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  feedback="select"
                  onPress={() => onDepartment(item.id)}
                  style={{ paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: 99, borderWidth: 1, borderColor: active ? C.brand : C.line, backgroundColor: active ? C.brand : C.white }}
                >
                  <T style={{ fontSize: 14, fontWeight: '600', color: active ? C.onAccent : C.ink }}>{item.name}</T>
                </Touch>
              );
            })}
          </Row>
          {group('على رأس العمل وقت التسجيل', onShift)}
          {group('بقية ' + (department?.name ?? 'القسم'), rest)}
          {!onShift.length && !rest.length ? <Sub style={{ paddingVertical: 14, textAlign: 'center' }}>ما فيه أحد في هذا القسم. ابحث بالاسم أو اختر قسم ثاني.</Sub> : null}
        </>
      )}
    </View>
  );
}
