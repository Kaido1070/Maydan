import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { addDays, formatDate, isTime } from '../domain/dates';
import {
  addFindingUpdate,
  deleteFinding,
  FINDING_NOUN,
  FINDING_PLURAL,
  FINDING_THE,
  LSR_RULES,
  findingAge,
  FindingInput,
  findingsOf,
  findingStats,
  isOverdue,
  lastDelayReason,
  saveFinding,
  STATUS_LABEL,
  validateFinding,
} from '../domain/findings';
import type { Finding, FindingKind, OvertimeEntry, Photo } from '../domain/types';
import { deleteOvertime, durationMinutes, formatDuration, isWorkTime, overtimeSummary, saveOvertime } from '../domain/worktime';
import { searchTechnicians } from '../domain/stats';
import { techTag } from '../domain/shifts';
import { deletePhotoFiles } from '../photos';
import { confirm } from '../sheets/VisitSheet';
import { useApply, useStore } from '../store';
import { Button, C, Card, Chip, Empty, Field, Icon, Row, s, SectionTitle, Segmented, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';
import { PhotoField } from '../ui/PhotoField';
import { useUi } from '../ui/ui';
import { EquipmentScreen } from './EquipmentScreen';
import { Touch } from '../ui/touch';

type Section = FindingKind | 'equipment' | 'overtime';

/** المتابعة: الملاحظات، المخالفات، مخالفات LSR، معدات التوزيع، والعمل خارج الدوام. */
export function FollowScreen() {
  const [section, setSection] = useState<Section>('observation');
  return (
    <View>
      <View style={{ marginTop: 6, marginBottom: 4 }}>
        <Segmented
          wrap
          options={[
            { value: 'observation', label: 'الملاحظات' },
            { value: 'violation', label: 'المخالفات' },
            { value: 'lsr', label: 'LSR' },
            { value: 'equipment', label: 'المعدات' },
            { value: 'overtime', label: 'خارج الدوام' },
          ]}
          value={section}
          onChange={setSection}
        />
      </View>
      {section === 'equipment' ? <EquipmentScreen /> : section === 'overtime' ? <OvertimeList /> : <FindingsList kind={section} />}
    </View>
  );
}

/* ───────────── الملاحظات والمخالفات ───────────── */

function FindingsList({ kind }: { kind: FindingKind }) {
  const { ws, now } = useStore();
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const noun = FINDING_NOUN[kind];
  const stats = findingStats(ws, kind, now.date);
  const list = findingsOf(ws, kind, now.date).filter((item) => (filter === 'open' ? item.status !== 'closed' : item.status === 'closed'));

  return (
    <View>
      <SectionTitle
        title={SECTION_TITLE[kind]}
        sub={SECTION_SUB[kind]}
        right={<Button testID={'add-' + kind} icon="plus" label={'إضافة ' + noun} onPress={() => setEditing('new')} />}
      />
      <Row gap={8} style={{ marginBottom: 10 }}>
        <Stat label="مفتوحة" value={stats.open} tone={stats.open ? 'amber' : 'neutral'} />
        <Stat label="متأخرة" value={stats.overdue} tone={stats.overdue ? 'red' : 'neutral'} />
        <Stat label="مقفلة" value={stats.closed} tone={stats.closed ? 'green' : 'neutral'} />
      </Row>
      {stats.open || stats.closed ? (
        <Sub style={{ marginBottom: 8 }}>
          {(stats.open ? (stats.oldestOpenDays ? 'أقدم ' + (kind === 'lsr' ? 'مخالفة LSR' : noun) + ' مفتوحة لها ' + stats.oldestOpenDays + ' يوم' : 'كل المفتوح انسجل اليوم') : 'ما فيه مفتوح') +
            (stats.avgDaysToClose !== null ? ' · متوسط الإغلاق ' + stats.avgDaysToClose + ' يوم' : '')}
        </Sub>
      ) : null}
      <View style={{ marginBottom: 10 }}>
        <Segmented
          options={[
            { value: 'open', label: 'المفتوحة · ' + stats.open },
            { value: 'closed', label: 'المقفلة · ' + stats.closed },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>
      {list.length ? (
        list.map((item) => <FindingCard key={item.id} finding={item} onPress={() => setEditing(item.id)} />)
      ) : (
        <Card>
          <Empty text={filter === 'open' ? 'ما فيه ' + (kind === 'lsr' ? 'مخالفات LSR' : FINDING_PLURAL[kind]) + ' مفتوحة 👍' : 'ما فيه شي مقفل للحين.'} />
        </Card>
      )}
      <FindingSheet kind={kind} findingId={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'red' | 'green' | 'neutral' }) {
  const color = tone === 'red' ? C.red : tone === 'amber' ? C.amber : tone === 'green' ? C.green : C.muted;
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 8, alignItems: 'center' }}>
      <T style={{ fontSize: 22, fontWeight: '700', color, lineHeight: 30 }}>{value}</T>
      <Sub>{label}</Sub>
    </View>
  );
}

function FindingCard({ finding, onPress }: { finding: Finding; onPress: () => void }) {
  const { ws, now } = useStore();
  const age = findingAge(finding, now.date);
  const overdue = isOverdue(finding, now.date);
  const reason = lastDelayReason(finding);
  const closed = finding.status === 'closed';
  return (
    <Touch testID={'finding-' + finding.id} accessibilityRole="button" accessibilityLabel={finding.title} onPress={onPress}>
      <Card style={overdue ? { borderColor: C.redLine, borderWidth: 1.5 } : undefined}>
        <Spread style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700', fontSize: 16 }}>{finding.title}</T>
            {finding.extra?.rule ? <Sub style={{ color: C.red }}>{'القاعدة: ' + finding.extra.rule}</Sub> : null}
            <Sub numberOfLines={1}>
              {[
                (finding.technicianIds ?? []).map((id) => ws.technicians.find((tech) => tech.id === id)?.name).filter(Boolean).join('، '),
                finding.location,
                finding.responsible,
                ws.departments.find((d) => d.id === finding.departmentId)?.name,
              ]
                .filter(Boolean)
                .join(' · ') || formatDate(finding.date)}
            </Sub>
          </View>
          <Chip tone={closed ? 'green' : overdue ? 'red' : finding.status === 'progress' ? 'purple' : 'amber'} label={overdue ? 'متأخرة' : STATUS_LABEL[finding.status]} />
        </Spread>
        <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <Chip tone={closed ? 'neutral' : age > 7 ? 'red' : age > 3 ? 'amber' : 'neutral'} icon="clock" label={closed ? 'انقفلت بعد ' + age + ' يوم' : age ? 'مفتوحة من ' + age + ' يوم' : 'انسجلت اليوم'} />
          {finding.dueDate && !closed ? <Chip tone={overdue ? 'red' : 'neutral'} icon="calendar" label={'الموعد ' + formatDate(finding.dueDate)} /> : null}
          {finding.photos.length ? <Chip tone="neutral" icon="image" label={String(finding.photos.length)} /> : null}
        </Row>
        {reason && !closed ? (
          <View style={{ backgroundColor: C.amberBg, borderRadius: 10, padding: 8, marginTop: 8 }}>
            <T style={{ fontSize: 13, color: C.amber }}>{'سبب التأخير: ' + reason}</T>
          </View>
        ) : null}
      </Card>
    </Touch>
  );
}

/** اختيار الفنيين أو الفرق المعنيين: بحث بالاسم أو الرقم، والمختارين يطلعون فوق. */
function TechnicianPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { ws } = useStore();
  const [query, setQuery] = useState('');
  const chosen = value.map((id) => ws.technicians.find((tech) => tech.id === id)).filter((tech): tech is NonNullable<typeof tech> => !!tech);
  const matches = searchTechnicians(ws, query).filter((tech) => !value.includes(tech.id)).slice(0, 6);
  return (
    <View style={{ marginBottom: 12 }}>
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>الفنيون أو الفرق المعنيون (اختياري)</T>
      {chosen.length ? (
        <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 6 }}>
          {chosen.map((tech) => (
            <Touch
              key={tech.id}
              testID={'finding-tech-remove-' + tech.id}
              accessibilityRole="button"
              accessibilityLabel={'إزالة ' + tech.name}
              feedback="select"
              onPress={() => onChange(value.filter((id) => id !== tech.id))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.soft, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 }}
            >
              <T style={{ fontSize: 13, color: C.link, fontWeight: '600' }}>{tech.name}</T>
              <Icon name="x" size={13} color={C.link} />
            </Touch>
          ))}
        </Row>
      ) : null}
      <TextInput
        testID="finding-tech-search"
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث بالاسم أو الرقم الوظيفي"
        placeholderTextColor={C.placeholder}
        style={s.input}
      />
      {matches.map((tech) => (
        <Touch
          key={tech.id}
          testID={'finding-tech-add-' + tech.id}
          accessibilityRole="button"
          accessibilityLabel={'إضافة ' + tech.name}
          feedback="select"
          scaleTo={0.98}
          onPress={() => {
            onChange([...value, tech.id]);
            setQuery('');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line }}
        >
          <Icon name="plus-circle" size={16} color={C.link} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={{ fontWeight: '600' }}>{tech.name}</T>
            <Sub numberOfLines={1}>{[techTag(tech), ws.departments.find((d) => d.id === tech.departmentId)?.name].filter(Boolean).join(' · ')}</Sub>
          </View>
        </Touch>
      ))}
      {query.trim() && !matches.length ? <Sub style={{ marginTop: 6 }}>ما لقيت أحد بهالاسم أو الرقم.</Sub> : null}
    </View>
  );
}

const SECTION_TITLE: Record<FindingKind, string> = {
  observation: 'ملاحظات السلامة',
  violation: 'المخالفات',
  lsr: 'مخالفات LSR',
};
const SECTION_SUB: Record<FindingKind, string> = {
  observation: 'سجّل الملاحظة وتابعها لين تنقفل، بدل ما تضيع بين الصور والقروبات.',
  violation: 'سجل المخالفات ومتابعتها. خانات النموذج تنضاف لما توصلني الصيغة.',
  lsr: 'مخالفات قواعد الحفاظ على الحياة: حدد القاعدة والفنيين وتابعها لين تنقفل.',
};
const TITLE_HINT: Record<FindingKind, string> = {
  observation: 'مثال: غطاء غرفة تفتيش مفتوح',
  violation: 'مثال: عدم لبس الخوذة',
  lsr: 'مثال: العمل على خط بدون عزل',
};

/** القاعدة المخالفة في LSR: اقتراحات سريعة، أو اكتبها بنفسك. */
function RulePicker({ value, onChange }: { value: string; onChange: (rule: string) => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Field testID="finding-rule" label="القاعدة المخالفة" value={value} onChangeText={onChange} placeholder="اختر من تحت أو اكتب القاعدة" />
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: -4 }}>
        {LSR_RULES.map((rule) => (
          <Touch
            key={rule}
            accessibilityRole="button"
            accessibilityState={{ selected: rule === value }}
            feedback="select"
            onPress={() => onChange(rule === value ? '' : rule)}
            style={{ borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: rule === value ? C.red : C.redBg }}
          >
            <T style={{ fontSize: 13, color: rule === value ? C.onAccent : C.red, fontWeight: '600' }}>{rule}</T>
          </Touch>
        ))}
      </Row>
    </View>
  );
}

const DUE_OPTIONS = [
  { value: 0, label: 'بدون موعد' },
  { value: 3, label: '3 أيام' },
  { value: 7, label: 'أسبوع' },
  { value: 14, label: 'أسبوعين' },
];

function FindingSheet({ kind, findingId, onClose }: { kind: FindingKind; findingId: string | 'new' | null; onClose: () => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const ui = useUi();
  const existing = (ws.findings ?? []).find((item) => item.id === findingId);
  const noun = FINDING_NOUN[kind];
  const empty = (): FindingInput => ({ kind, title: '', description: '', location: '', responsible: '', date: now.date, photos: [] });
  const [draft, setDraft] = useState<FindingInput>(empty);
  const [error, setError] = useState<string | null>(null);
  const [updateKind, setUpdateKind] = useState<'note' | 'delay'>('note');
  const [updateText, setUpdateText] = useState('');

  useEffect(() => {
    if (!findingId) return;
    setDraft(existing ? { ...existing } : empty());
    setError(null);
    setUpdateText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findingId]);

  if (!findingId) return null;
  const set = (patch: Partial<FindingInput>) => setDraft((prev) => ({ ...prev, ...patch }));
  const original = existing?.photos ?? [];
  const ids = (photos: Photo[]) => new Set(photos.map((p) => p.id));

  const close = () => {
    const kept = ids(original);
    deletePhotoFiles(draft.photos.filter((p) => !kept.has(p.id)));
    onClose();
  };
  const save = () => {
    const problem = validateFinding(draft);
    if (problem) return setError(problem);
    const failure = apply((current) => saveFinding(current, draft, existing?.id).ws);
    if (failure) return setError(failure);
    const kept = ids(draft.photos);
    deletePhotoFiles(original.filter((p) => !kept.has(p.id)));
    ui.notify(existing ? 'تم حفظ التعديل' : 'تم تسجيل ' + FINDING_THE[kind]);
    onClose();
  };
  const addUpdate = (kindOfUpdate: 'note' | 'delay' | 'close' | 'reopen') => {
    if (!existing) return;
    const failure = apply((current) => addFindingUpdate(current, existing.id, { date: now.date, kind: kindOfUpdate, text: updateText }));
    if (failure) return setError(failure);
    setUpdateText('');
    setError(null);
    if (kindOfUpdate === 'close') {
      ui.notify('🎉 انقفلت ' + FINDING_THE[kind] + ' بعد ' + findingAge(existing, now.date) + ' يوم');
      onClose();
    }
  };
  const remove = () =>
    confirm('حذف «' + existing!.title + '»؟', () => {
      apply((current) => deleteFinding(current, existing!.id));
      deletePhotoFiles([...original, ...draft.photos]);
      ui.notify('تم الحذف');
      onClose();
    });

  const dueDays = draft.dueDate ? Math.max(0, Math.round((new Date(draft.dueDate).getTime() - new Date(draft.date).getTime()) / 86400000)) : 0;
  const closed = existing?.status === 'closed';

  return (
    <Sheet
      visible
      onClose={close}
      title={existing ? existing.title : 'إضافة ' + noun}
      sub={existing ? STATUS_LABEL[existing.status] + ' · ' + (closed ? 'انقفلت بعد ' : 'لها ') + findingAge(existing, now.date) + ' يوم' : undefined}
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="finding-save" style={{ flex: 1 }} label={existing ? 'حفظ التعديل' : 'حفظ'} onPress={save} />
            {existing ? <Button variant="danger" label="حذف" onPress={remove} /> : null}
          </Row>
        </>
      }
    >
      {existing ? (
        <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 12 }}>
          <T style={{ fontWeight: '700', marginBottom: 4 }}>المتابعة</T>
          {existing.updates.length ? (
            existing.updates.map((update) => (
              <Row key={update.id} style={{ alignItems: 'flex-start', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                <Icon
                  name={update.kind === 'delay' ? 'alert-circle' : update.kind === 'close' ? 'check-circle' : update.kind === 'reopen' ? 'rotate-ccw' : 'message-circle'}
                  size={15}
                  color={update.kind === 'delay' ? C.amber : update.kind === 'close' ? C.green : C.muted}
                />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 14 }}>
                    {(update.kind === 'delay' ? 'سبب تأخير: ' : update.kind === 'close' ? 'إغلاق' + (update.text ? ': ' : '') : update.kind === 'reopen' ? 'إعادة فتح' : '') + update.text}
                  </T>
                  <Sub>{formatDate(update.date, { weekday: true })}</Sub>
                </View>
              </Row>
            ))
          ) : (
            <Sub>ما فيه تحديثات للحين.</Sub>
          )}
          {!closed ? (
            <>
              <View style={{ marginTop: 8 }}>
                <Segmented
                  options={[
                    { value: 'note', label: 'تحديث' },
                    { value: 'delay', label: 'سبب تأخير' },
                  ]}
                  value={updateKind}
                  onChange={setUpdateKind}
                />
              </View>
              <TextInput
                testID="finding-update-text"
                value={updateText}
                onChangeText={setUpdateText}
                placeholder={updateKind === 'delay' ? 'ليش طولت؟ مثل: بانتظار المقاول' : 'وش صار؟'}
                placeholderTextColor={C.placeholder}
                style={[s.input, { marginTop: 8 }]}
              />
              <Row style={{ marginTop: 8 }}>
                <Button testID="finding-add-update" small style={{ flex: 1 }} variant="secondary" label="إضافة" disabled={!updateText.trim()} onPress={() => addUpdate(updateKind)} />
                <Button testID="finding-close" small style={{ flex: 1, backgroundColor: C.green }} icon="check" label="إغلاق" onPress={() => addUpdate('close')} />
              </Row>
            </>
          ) : (
            <Button small variant="secondary" icon="rotate-ccw" label="إعادة فتح" style={{ marginTop: 8 }} onPress={() => addUpdate('reopen')} />
          )}
        </View>
      ) : null}

      <Field testID="finding-title" label={'عنوان ' + FINDING_THE[kind]} value={draft.title} onChangeText={(title) => set({ title })} placeholder={TITLE_HINT[kind]} />
      {kind === 'lsr' ? <RulePicker value={draft.extra?.rule ?? ''} onChange={(rule) => set({ extra: { ...draft.extra, rule } })} /> : null}
      <Field label="الموقع" value={draft.location} onChangeText={(location) => set({ location })} placeholder="مثال: حي الروضة، شارع ..." />
      <Field label="المسؤول عن الإغلاق" value={draft.responsible} onChangeText={(responsible) => set({ responsible })} placeholder="فني، مقاول، أو جهة" />
      <TechnicianPicker
        value={draft.technicianIds ?? []}
        onChange={(technicianIds) => {
          const first = ws.technicians.find((tech) => tech.id === technicianIds[0]);
          set({ technicianIds, ...(!draft.departmentId && first ? { departmentId: first.departmentId } : {}) });
        }}
      />
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>القسم (اختياري)</T>
      <Segmented
        wrap
        options={[{ value: '', label: 'بدون' }, ...ws.departments.map((d) => ({ value: d.id, label: d.name }))]}
        value={draft.departmentId ?? ''}
        onChange={(departmentId) => set({ departmentId: departmentId || undefined })}
      />
      <Spread style={{ marginTop: 12, marginBottom: 6 }}>
        <T style={{ fontWeight: '700', fontSize: 13 }}>تاريخ التسجيل</T>
        <Stepper label={formatDate(draft.date)} onPrev={() => set({ date: addDays(draft.date, -1) })} onNext={() => set({ date: addDays(draft.date, 1) })} nextDisabled={draft.date >= now.date} />
      </Spread>
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>موعد الإغلاق</T>
      <Segmented
        wrap
        options={DUE_OPTIONS}
        value={DUE_OPTIONS.some((o) => o.value === dueDays) ? dueDays : -1}
        onChange={(days) => set({ dueDate: days ? addDays(draft.date, days) : undefined })}
      />
      {draft.dueDate ? <Sub style={{ marginTop: 4 }}>{'الموعد: ' + formatDate(draft.dueDate, { weekday: true, year: true })}</Sub> : null}
      <T style={{ fontWeight: '700', fontSize: 13, marginTop: 12, marginBottom: 4 }}>الوصف (اختياري)</T>
      <TextInput
        value={draft.description}
        onChangeText={(description) => set({ description })}
        multiline
        placeholder="تفاصيل أكثر"
        placeholderTextColor={C.placeholder}
        style={[s.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 10 }]}
      />
      <PhotoField testID="finding-photos" title="الصور" photos={draft.photos} onChange={(photos) => set({ photos })} onError={setError} />
      {kind !== 'observation' ? (
        <View style={{ backgroundColor: C.subtle, borderRadius: 12, padding: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.softLine }}>
          <T style={{ fontWeight: '700', fontSize: 13 }}>{kind === 'lsr' ? 'خانات نموذج LSR' : 'خانات نموذج المخالفة'}</T>
          <Sub>بتنضاف هنا لما ترسل نموذج المخالفات.</Sub>
        </View>
      ) : null}
    </Sheet>
  );
}

/* ───────────── العمل خارج الدوام ───────────── */

function monthRange(date: string) {
  const start = date.slice(0, 8) + '01';
  const next = new Date(start + 'T12:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: next.toISOString().slice(0, 10) };
}

function OvertimeList() {
  const { ws, now } = useStore();
  const ui = useUi();
  const month = monthRange(now.date);
  const summary = overtimeSummary(ws, month.start, month.end);
  const entries = [...(ws.overtime ?? [])].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const outside = !isWorkTime(ws.settings, now.date, now.time);

  return (
    <View>
      <SectionTitle
        title="العمل خارج الدوام"
        sub="سجّل كل مرة تطلع فيها خارج دوامك. والزيارات والاجتماعات اللي تنسجل خارج الدوام تنحسب تلقائيًا."
        right={<Button testID="add-overtime" icon="plus" label="تسجيل" onPress={() => ui.openOvertime(null)} />}
      />
      <Card>
        <T style={{ fontWeight: '700', marginBottom: 8 }}>{'هذا الشهر'}</T>
        <Row gap={8}>
          <Stat label="مرات مسجلة" value={summary.entries} tone={summary.entries ? 'amber' : 'neutral'} />
          <Stat label="أيام" value={summary.days} tone={summary.days ? 'amber' : 'neutral'} />
          <Stat label="نشاط خارج الدوام" value={summary.outOfHoursActivities} tone={summary.outOfHoursActivities ? 'amber' : 'neutral'} />
        </Row>
        <Sub style={{ marginTop: 8 }}>{'مجموع الوقت المسجل: ' + (summary.minutes ? formatDuration(summary.minutes) : 'صفر')}</Sub>
        {outside ? <Chip tone="amber" icon="moon" label="أنت خارج الدوام الحين" /> : null}
      </Card>
      {entries.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {entries.map((entry, index) => (
            <Touch key={entry.id} accessibilityRole="button" onPress={() => ui.openOvertime(entry.id)} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <Spread>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }}>{entry.reason}</T>
                  <Sub>{formatDate(entry.date, { weekday: true, year: true }) + ' · ⁦' + entry.start + ' – ' + entry.end + '⁩'}</Sub>
                </View>
                <Chip tone="amber" icon="clock" label={formatDuration(durationMinutes(entry.start, entry.end))} />
              </Spread>
            </Touch>
          ))}
        </Card>
      ) : (
        <Card>
          <Empty text="ما سجلت عمل خارج الدوام للحين." />
        </Card>
      )}
    </View>
  );
}

/** تسجيل أو تعديل عمل خارج الدوام (يفتح من صفحة اليوم أو المتابعة). */
export function OvertimeSheet({ entryId, visible, onClose }: { entryId: string | null; visible: boolean; onClose: () => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const ui = useUi();
  const existing = (ws.overtime ?? []).find((item) => item.id === entryId);
  const [draft, setDraft] = useState<Omit<OvertimeEntry, 'id' | 'createdAt'>>({ date: now.date, start: now.time, end: now.time, reason: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(existing ? { date: existing.date, start: existing.start, end: existing.end, reason: existing.reason } : { date: now.date, start: now.time, end: now.time, reason: '' });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entryId]);

  if (!visible) return null;
  const save = () => {
    if (!isTime(draft.start) || !isTime(draft.end)) return setError('اكتب الأوقات بصيغة 24 ساعة مثل 18:30');
    const failure = apply((current) => saveOvertime(current, draft, existing?.id));
    if (failure) return setError(failure);
    ui.notify('تم تسجيل العمل خارج الدوام · ' + formatDuration(durationMinutes(draft.start, draft.end)));
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={existing ? 'تعديل عمل خارج الدوام' : 'عمل خارج الدوام'}
      sub="البداية والنهاية والسبب"
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="overtime-save" style={{ flex: 1 }} label="حفظ" onPress={save} />
            {existing ? (
              <Button
                variant="danger"
                label="حذف"
                onPress={() =>
                  confirm('حذف هذا التسجيل؟', () => {
                    apply((current) => deleteOvertime(current, existing.id));
                    onClose();
                  })
                }
              />
            ) : null}
          </Row>
        </>
      }
    >
      <Spread style={{ marginBottom: 10 }}>
        <T style={{ fontWeight: '700', fontSize: 13 }}>التاريخ</T>
        <Stepper label={formatDate(draft.date)} onPrev={() => setDraft({ ...draft, date: addDays(draft.date, -1) })} onNext={() => setDraft({ ...draft, date: addDays(draft.date, 1) })} nextDisabled={draft.date >= now.date} />
      </Spread>
      <Row>
        <View style={{ flex: 1 }}>
          <Field testID="overtime-start" label="من" value={draft.start} onChangeText={(start) => setDraft({ ...draft, start })} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Field testID="overtime-end" label="إلى" value={draft.end} onChangeText={(end) => setDraft({ ...draft, end })} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
      </Row>
      {isTime(draft.start) && isTime(draft.end) && draft.start !== draft.end ? <Sub style={{ marginTop: -4, marginBottom: 8 }}>{'المدة: ' + formatDuration(durationMinutes(draft.start, draft.end))}</Sub> : null}
      <Field testID="overtime-reason" label="السبب" value={draft.reason} onChangeText={(reason) => setDraft({ ...draft, reason })} placeholder="مثال: بلاغ طوارئ، متابعة عمل ليلي" />
    </Sheet>
  );
}
