import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatDate, WEEKDAYS_AR } from '../domain/dates';
import { removePlanItem } from '../domain/plan';
import { deleteMeeting, renameMeeting } from '../domain/records';
import { shiftName } from '../domain/shifts';
import type { Settings, Workspace } from '../domain/types';
import { shareText } from '../exporting';
import { DepartmentPicker } from './DepartmentPicker';
import { rotationText } from './RosterScreen';
import { DepartmentSheet, IconLine, PlanItemSheet, TechnicianEditSheet } from '../sheets/SettingsSheets';
import { confirm } from '../sheets/VisitSheet';
import { useApply, useStore } from '../store';
import { Button, C, Card, Chip, Empty, Field, Row, s, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';

export function SettingsScreen() {
  const store = useStore();
  const { ws, mode, now } = store;
  const apply = useApply();
  const ui = useUi();
  const [deptSheet, setDeptSheet] = useState<string | null>(null);
  const [techSheet, setTechSheet] = useState<string | null>(null);
  const [planSheet, setPlanSheet] = useState(false);
  const [techDept, setTechDept] = useState<string | null>(ws.departments[0]?.id ?? null);
  const [importText, setImportText] = useState('');
  const year = Number(now.date.slice(0, 4));

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => apply((c) => ({ ...c, settings: { ...c.settings, [key]: value } }));
  const saved = (message: string) => ui.notify(message);

  const importLive = () => {
    try {
      const parsed = JSON.parse(importText) as Workspace;
      if (!Array.isArray(parsed.departments) || !Array.isArray(parsed.technicians) || !Array.isArray(parsed.visits)) throw new Error();
      confirm('استبدال بيانات العمل الحالية بالنسخة المستوردة؟', () => {
        store.replaceLive({ ...parsed, overrides: parsed.overrides ?? {}, attendance: parsed.attendance ?? [], meetings: parsed.meetings ?? [], plan: parsed.plan ?? [] });
        setImportText('');
        ui.notify('تم استيراد بيانات العمل');
      });
    } catch {
      ui.notify('النص ليس نسخة احتياطية صحيحة من ميدان');
    }
  };

  return (
    <View>
      <SectionTitle title="وضع البيانات" />
      <Card>
        <Segmented
          options={[
            { value: 'demo', label: 'وضع التجربة' },
            { value: 'live', label: 'بيانات العمل' },
          ]}
          value={mode}
          onChange={store.setMode}
        />
        <Sub style={{ marginTop: 8 }}>
          {mode === 'demo'
            ? 'أنت في وضع التجربة: الأسماء والأرقام الوظيفية وبعض أوقات الدوام تجريبية، وكل ما تسجله هنا منفصل تمامًا عن بيانات العمل.'
            : 'أنت في بيانات العمل: أضف الأقسام والفنيين وأوقات الدوام الفعلية من الأسفل. وضع التجربة محفوظ بشكل منفصل.'}
        </Sub>
        {mode === 'demo' ? (
          <Button style={{ marginTop: 10 }} variant="secondary" icon="refresh-cw" label="إعادة بيانات التجربة" onPress={() => confirm('إعادة وضع التجربة لبياناته الأصلية؟', () => (store.resetDemo(), ui.notify('تمت إعادة بيانات التجربة')))} />
        ) : (
          <Button
            style={{ marginTop: 10 }}
            variant="danger"
            icon="trash-2"
            label="مسح بيانات العمل"
            onPress={() => confirm('مسح كل بيانات العمل (الفنيين والزيارات والحضور)؟ لا يمكن التراجع.', () => (store.resetLive(), ui.notify('تم مسح بيانات العمل')))}
          />
        )}
      </Card>

      <SectionTitle title="الأهداف والتحفيز" sub="تنطبق على الوضع الحالي" />
      <Card>
        <Field label="اسم المهندس (يظهر في بطاقة الإنجاز والتقارير)" value={ws.settings.engineerName} onChangeText={(v) => setSetting('engineerName', v)} />
        <NumberRow label="هدف الزيارات اليومي" value={ws.settings.dailyVisitGoal} min={1} onChange={(v) => setSetting('dailyVisitGoal', v)} />
        <NumberRow label="هدف زيارات كل فني" value={ws.settings.visitTarget} min={1} onChange={(v) => setSetting('visitTarget', v)} />
        <NumberRow label="نافذة الزيارات (أشهر)" value={ws.settings.visitWindowMonths} min={1} onChange={(v) => setSetting('visitWindowMonths', v)} />
        <IconLine icon="zap" text={'كل زيارة +' + ws.settings.xpVisit + ' XP وكل تسجيل حضور اجتماع +' + ws.settings.xpMeeting + ' XP، وكل 100 XP مستوى جديد.'} />
      </Card>

      <SectionTitle title="الأقسام والشفتات" sub="بداية الدورات وأوقات الدوام" />
      {ws.departments.map((department) => (
        <Card key={department.id}>
          <Spread style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '800' }}>{department.name}</T>
              <Sub>{department.shifts.map((s) => s.name).join('، ')}</Sub>
              <Sub>{rotationText(department)}</Sub>
            </View>
            <Button small variant="secondary" label="تعديل" testID={'edit-dept-' + department.id} onPress={() => setDeptSheet(department.id)} />
          </Spread>
        </Card>
      ))}

      <SectionTitle
        title="الفنيون"
        sub={ws.technicians.filter((t) => t.active !== false).length + ' فني نشط'}
        right={<Button small icon="user-plus" label="إضافة فني" testID="add-tech" onPress={() => setTechSheet('new')} />}
      />
      <DepartmentPicker value={techDept} onChange={setTechDept} icon="users" />
      <Card style={{ paddingVertical: 4 }}>
        {ws.technicians.filter((t) => t.departmentId === techDept).length ? (
          ws.technicians
            .filter((t) => t.departmentId === techDept)
            .map((tech, index) => (
              <Spread key={tech.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700', fontSize: 13, color: tech.active === false ? C.muted : C.ink }}>{tech.name}</T>
                  <Sub>{tech.employeeNumber + ' · ' + shiftName(ws, tech) + (tech.active === false ? ' · غير نشط' : '')}</Sub>
                </View>
                <Button small variant="secondary" label="تعديل" onPress={() => setTechSheet(tech.id)} />
              </Spread>
            ))
        ) : (
          <Empty text="ما فيه فنيون في هذا القسم." />
        )}
      </Card>

      <SectionTitle title={'اجتماعات ' + year} sub="تضيف العناوين الجديدة من شاشة الاجتماعات مباشرة" />
      <Card style={{ paddingVertical: 4 }}>
        {ws.meetings.filter((m) => m.year === year).length ? (
          ws.meetings
            .filter((m) => m.year === year)
            .map((meeting, index) => (
              <MeetingRow
                key={meeting.id}
                first={!index}
                title={meeting.title}
                onRename={(title) => {
                  const err = apply((c) => renameMeeting(c, meeting.id, title));
                  ui.notify(err ?? 'تم تعديل العنوان');
                }}
                onDelete={() => confirm('حذف «' + meeting.title + '» مع سجلات حضوره؟', () => (apply((c) => deleteMeeting(c, meeting.id)), ui.notify('تم حذف الاجتماع')))}
              />
            ))
        ) : (
          <Empty text="ما فيه اجتماعات لهذه السنة." />
        )}
      </Card>

      <SectionTitle title="الخطة الأسبوعية" sub="مهام تظهر في جدول أعمال اليوم" right={<Button small icon="plus" label="مهمة" onPress={() => setPlanSheet(true)} />} />
      <Card style={{ paddingVertical: 4 }}>
        {ws.plan.length ? (
          [...ws.plan]
            .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
            .map((item, index) => (
              <Spread key={item.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 13, fontWeight: '700' }}>{item.title}</T>
                  <Sub>{WEEKDAYS_AR[item.weekday] + ' · ' + item.time + ' · ' + (ws.departments.find((d) => d.id === item.departmentId)?.name ?? '—')}</Sub>
                </View>
                <Chip tone={item.kind === 'visit' ? 'purple' : 'amber'} label={item.kind === 'visit' ? 'زيارة' : 'اجتماع'} />
                <Button small variant="danger" label="حذف" onPress={() => apply((c) => removePlanItem(c, item.id))} />
              </Spread>
            ))
        ) : (
          <Empty text="ما فيه مهام في الخطة الأسبوعية." />
        )}
      </Card>

      {mode === 'live' ? (
        <>
          <SectionTitle title="نسخة احتياطية" sub="بيانات العمل محفوظة على الجهاز. صدّر نسخة بشكل دوري." />
          <Card>
            <Button
              variant="secondary"
              icon="download"
              label="تصدير نسخة احتياطية (JSON)"
              onPress={() => shareText('Maydan-Backup-' + now.date + '.json', store.exportBackup(), 'application/json', 'public.json').catch(() => ui.notify('تعذر التصدير'))}
            />
            <TextInput
              value={importText}
              onChangeText={setImportText}
              multiline
              placeholder="الصق محتوى النسخة الاحتياطية هنا للاستيراد"
              placeholderTextColor="#a29db3"
              style={[s.input, { minHeight: 80, marginTop: 10, textAlignVertical: 'top', paddingTop: 8, fontSize: 12 }]}
            />
            <Button style={{ marginTop: 8 }} variant="secondary" label="استيراد" disabled={!importText.trim()} onPress={importLive} />
          </Card>
        </>
      ) : null}

      <Sub style={{ marginTop: 14, textAlign: 'center' }}>{'ميدان · التوقيت: السعودية (UTC+3) · ' + formatDate(now.date, { weekday: true, year: true }) + ' ' + now.time}</Sub>

      <DepartmentSheet departmentId={deptSheet} onClose={() => setDeptSheet(null)} onSaved={(m) => (setDeptSheet(null), saved(m))} />
      <TechnicianEditSheet technicianId={techSheet} onClose={() => setTechSheet(null)} onSaved={(m) => (setTechSheet(null), saved(m))} />
      <PlanItemSheet visible={planSheet} onClose={() => setPlanSheet(false)} onSaved={(m) => (setPlanSheet(false), saved(m))} />
    </View>
  );
}

function NumberRow({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <Spread style={{ marginBottom: 8 }}>
      <T style={{ fontSize: 13 }}>{label}</T>
      <Stepper label={String(value)} onPrev={() => onChange(Math.max(min, value - 1))} onNext={() => onChange(value + 1)} prevDisabled={value <= min} />
    </Spread>
  );
}

function MeetingRow({ title, first, onRename, onDelete }: { title: string; first: boolean; onRename: (t: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(title);
  return (
    <Row style={{ paddingVertical: 8, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
      <TextInput value={value} onChangeText={setValue} style={[s.input, { flex: 1, minHeight: 38, fontSize: 14 }]} />
      <Button small variant="secondary" label="حفظ" disabled={value.trim() === title} onPress={() => onRename(value)} />
      <Button small variant="danger" label="حذف" onPress={onDelete} />
    </Row>
  );
}
