import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatDate } from '../domain/dates';
import { addMeeting, deleteMeeting, renameMeeting } from '../domain/records';
import { shiftName, techTag } from '../domain/shifts';
import { weeklyGoal } from '../domain/stats';
import { scheduleOf } from '../domain/worktime';
import { isTime, WEEKDAYS_AR } from '../domain/dates';
import { Pressable } from 'react-native';
import { addDepartment } from '../domain/plan';
import { addPlace, deletePlace, PLACE_HINT, PLACE_NOUN, placesOf } from '../domain/places';
import type { PlaceKind } from '../domain/types';
import type { Settings, Workspace } from '../domain/types';
import { previewTechnicianImport, type ImportPreview } from '../domain/importer';
import { buildTechnicianWorkbook, pickSpreadsheet, readTable, XLSX_MIME, XLSX_UTI } from '../excel';
import { shareBytes, shareText } from '../exporting';
import { ImportSheet } from '../sheets/ImportSheet';
import { DepartmentPicker } from './DepartmentPicker';
import { rotationText } from './RosterScreen';
import { DepartmentSheet, IconLine, TechnicianEditSheet } from '../sheets/SettingsSheets';
import { confirm } from '../sheets/VisitSheet';
import { useApply, useStore } from '../store';
import { Button, C, Card, Checkbox, Chip, Empty, Field, Icon, IconBox, IconName, Row, s, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';
import { BLUR_LABELS } from '../ui/theme';
import { CHANGELOG, versionLabel } from '../version';
import { Touch } from '../ui/touch';

export function SettingsScreen() {
  const store = useStore();
  const { ws, mode, now } = store;
  const apply = useApply();
  const ui = useUi();
  const section = ui.settingsSection;
  const [deptSheet, setDeptSheet] = useState<string | null>(null);
  const [techSheet, setTechSheet] = useState<string | null>(null);
  const [techDept, setTechDept] = useState<string | null>(ws.departments[0]?.id ?? null);
  const [importText, setImportText] = useState('');
  const [newDept, setNewDept] = useState('');
  const [excel, setExcel] = useState<{ file: string; preview: ImportPreview } | null>(null);

  const importExcel = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (!picked) return;
      setExcel({ file: picked.name, preview: previewTechnicianImport(ws, readTable(picked.bytes)) });
    } catch (error) {
      ui.notify('تعذر قراءة الملف: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  const exportExcel = () =>
    shareBytes('Maydan-Technicians-' + now.date + '.xlsx', buildTechnicianWorkbook(ws), XLSX_MIME, XLSX_UTI).catch((error) =>
      ui.notify('تعذر التصدير: ' + (error instanceof Error ? error.message : String(error))),
    );
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
      {!section ? (
        <>
      <Card style={{ marginTop: 14 }}>
        <Spread>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '800', fontSize: 16 }}>ميدان</T>
            <Sub testID="app-version">{'الإصدار ' + versionLabel()}</Sub>
            <Sub>{CHANGELOG[0].title + ' · ' + formatDate(CHANGELOG[0].date, { year: true })}</Sub>
          </View>
          <Button small variant="secondary" icon="list" label="سجل التحديثات" testID="open-changelog" onPress={ui.openChangelog} />
        </Spread>
      </Card>
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
        ) : null}
      </Card>


      <SectionTitle title="بياناتي" sub={mode === 'demo' ? 'بيانات تجريبية. بدّل إلى «بيانات العمل» وأدخل بياناتك.' : 'أدخل بياناتك من هنا، والتطبيق يرتب الباقي.'} />
      <Card style={{ paddingVertical: 2 }}>
        <MenuRow first testID="settings-people" icon="users" title="الموظفون والفرق" sub="استيراد من Excel أو إضافة يدوية" count={ws.technicians.filter((t) => t.active !== false).length} onPress={() => ui.go('settings', { section: 'people' })} />
        <MenuRow testID="settings-places" icon="package" title="المستودعات والمواقع والمعدات" sub="مستودعات، نقاط انطلاق، معدات توزيع" count={placesOf(ws).length} onPress={() => ui.go('settings', { section: 'places' })} />
        <MenuRow testID="settings-meetings" icon="message-square" title="عناوين الاجتماعات" sub={'اجتماعات سنة ' + year} count={ws.meetings.filter((m) => m.year === year).length} onPress={() => ui.go('settings', { section: 'meetings' })} />
        <MenuRow testID="settings-departments" icon="layers" title="الأقسام والشفتات" sub="الدورات وأوقات الدوام" count={ws.departments.length} onPress={() => ui.go('settings', { section: 'departments' })} />
      </Card>
      <SectionTitle title="الإعدادات" />
      <Card style={{ paddingVertical: 2 }}>
        <MenuRow first testID="settings-goals" icon="target" title="الأهداف ودوامي" sub={'\u2066' + ws.settings.dailyVisitGoal + '\u2069 زيارات في اليوم · ' + scheduleOf(ws.settings).days.length + ' أيام دوام'} onPress={() => ui.go('settings', { section: 'goals' })} />
        <MenuRow testID="settings-appearance" icon="moon" title="المظهر" sub={(store.theme === 'dark' ? 'داكن' : 'فاتح') + ' · الشريط السفلي ' + (store.prefs.glass ? 'زجاجي' : 'عادي')} onPress={() => ui.go('settings', { section: 'appearance' })} />
        {mode === 'live' ? <MenuRow testID="settings-backup" icon="shield" title="نسخة احتياطية" sub="صدّر بياناتك واحفظها" onPress={() => ui.go('settings', { section: 'backup' })} /> : null}
      </Card>

        </>
      ) : (
        <Touch testID="settings-back" accessibilityRole="button" feedback="select" onPress={() => ui.go('settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 }}>
          <Icon name="chevron-right" size={18} color={C.link} />
          <T style={{ color: C.link, fontWeight: '700' }}>الإعدادات</T>
        </Touch>
      )}

      {section === 'goals' ? (
        <>
      <SectionTitle title="الأهداف والتحفيز" sub="تنطبق على الوضع الحالي" />
      <Card>
        <Field label="اسم المهندس (يظهر في بطاقة الإنجاز والتقارير)" value={ws.settings.engineerName} onChangeText={(v) => setSetting('engineerName', v)} />
        <NumberRow label="هدف الزيارات اليومي" value={ws.settings.dailyVisitGoal} min={1} onChange={(v) => setSetting('dailyVisitGoal', v)} />
        <NumberRow label="هدف الزيارات الأسبوعي" value={weeklyGoal(ws)} min={1} onChange={(v) => setSetting('weeklyVisitGoal', v)} />
        <NumberRow label="هدف زيارات كل فني" value={ws.settings.visitTarget} min={1} onChange={(v) => setSetting('visitTarget', v)} />
        <NumberRow label="مستودعات كل ربع سنة" value={ws.settings.warehouseQuarterGoal ?? 2} min={1} onChange={(v) => setSetting('warehouseQuarterGoal', v)} />
        <NumberRow label="نافذة الزيارات (أشهر)" value={ws.settings.visitWindowMonths} min={1} onChange={(v) => setSetting('visitWindowMonths', v)} />
        <IconLine icon="zap" text={'كل زيارة +' + ws.settings.xpVisit + ' XP وكل تسجيل حضور اجتماع +' + ws.settings.xpMeeting + ' XP، وكل 100 XP مستوى جديد.'} />
      </Card>

      <SectionTitle title="دوامي" sub="جزء ميدان وجزء مكتب. يحدد أيام الأهداف والعمل خارج الدوام." />
      <WorkScheduleCard />

        </>
      ) : null}

      {section === 'appearance' ? (
        <>
          <SectionTitle title="المظهر" sub="تنحفظ على الجهاز وتتطبق مباشرة." />
          <Card>
            <T style={{ fontWeight: '700', marginBottom: 8 }}>الوضع</T>
            <Segmented
              options={[
                { value: 'light', label: 'عادي' },
                { value: 'dark', label: 'داكن' },
                { value: 'system', label: 'حسب الجهاز' },
              ]}
              value={store.prefs.theme}
              onChange={(theme) => store.setPrefs({ theme })}
            />
          </Card>
          <Card>
            <Spread>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>الشريط السفلي الزجاجي</T>
                <Sub>عائم وشفاف فوق المحتوى. إذا طفيته يرجع شريط عادي ثابت.</Sub>
              </View>
              <Checkbox testID="pref-glass" label="الشريط السفلي الزجاجي" checked={store.prefs.glass} onChange={(glass) => store.setPrefs({ glass })} />
            </Spread>
            <T style={{ fontWeight: '700', marginTop: 14, marginBottom: 8, opacity: store.prefs.glass ? 1 : 0.4 }}>درجة التعتيم</T>
            <View style={{ opacity: store.prefs.glass ? 1 : 0.4 }} pointerEvents={store.prefs.glass ? 'auto' : 'none'}>
              <Segmented options={BLUR_LABELS.map((label, value) => ({ value: value as 0 | 1 | 2 | 3, label }))} value={store.prefs.blur} onChange={(blur) => store.setPrefs({ blur })} />
            </View>
            <Sub style={{ marginTop: 8 }}>«شفاف» يبيّن اللي وراه أكثر، و«قوي» أوضح للقراءة. على iOS 26 وأحدث يستخدم زجاج النظام.</Sub>
          </Card>
        </>
      ) : null}

      {section === 'departments' ? (
        <>
      <SectionTitle title="الأقسام والشفتات" sub="بداية الدورات وأوقات الدوام" right={<Button small variant="secondary" icon="calendar" label="جدول الشفتات" onPress={() => ui.go('roster')} />} />
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

      <Card>
        <T style={{ fontWeight: '700', marginBottom: 6 }}>إضافة قسم</T>
        <Row>
          <TextInput
            testID="new-dept-name"
            value={newDept}
            onChangeText={setNewDept}
            placeholder="اسم القسم"
            placeholderTextColor={C.placeholder}
            style={[s.input, { flex: 1, minWidth: 0 }]}
          />
          <Button
            testID="add-dept"
            icon="plus"
            label="إضافة"
            disabled={!newDept.trim()}
            onPress={() => {
              const error = apply((c) => addDepartment(c, newDept));
              if (error) return ui.notify(error);
              setNewDept('');
              ui.notify('تمت إضافة القسم. عدّل شفتاته وأوقاته من «تعديل»');
            }}
          />
        </Row>
      </Card>

        </>
      ) : null}

      {section === 'places' ? (
        <>
      <SectionTitle title="المستودعات ونقاط الانطلاق" sub="المطلوب زيارة مستودعين كل ربع سنة، وتطلع في خطة اليوم لين يتحقق الهدف" />
      <PlacesCard />

        </>
      ) : null}

      {section === 'people' ? (
        <>
      <SectionTitle
        title="الموظفون والفرق"
        sub={ws.technicians.filter((t) => t.active !== false).length + ' نشط'}
        right={<Button small icon="user-plus" label="إضافة يدوية" testID="add-tech" onPress={() => setTechSheet('new')} />}
      />
      <Card>
        <T style={{ fontWeight: '800' }}>استيراد من Excel</T>
        <Sub>
          نزّل النموذج، عبّئ أسماء الفنيين وأرقامهم وأقسامهم وشفتاتهم، ثم استورده هنا. الملف يُقرأ على جهازك فقط وما يرفع لأي مكان.
          {ws.technicians.length ? ' النموذج يحتوي القائمة الحالية، فتقدر تعدلها وتعيد استيرادها.' : ''}
        </Sub>
        <Row style={{ marginTop: 10 }}>
          <Button testID="excel-template" style={{ flex: 1 }} small variant="secondary" icon="download" label={ws.technicians.length ? 'تصدير القائمة (Excel)' : 'تنزيل نموذج Excel'} onPress={exportExcel} />
          <Button testID="excel-import" style={{ flex: 1 }} small icon="upload" label="استيراد ملف Excel" onPress={importExcel} />
        </Row>
      </Card>
      <DepartmentPicker value={techDept} onChange={setTechDept} icon="users" />
      <Card style={{ paddingVertical: 4 }}>
        {ws.technicians.filter((t) => t.departmentId === techDept).length ? (
          ws.technicians
            .filter((t) => t.departmentId === techDept)
            .map((tech, index) => (
              <Spread key={tech.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700', fontSize: 13, color: tech.active === false ? C.muted : C.ink }}>{tech.name}</T>
                  <Sub>{techTag(tech) + ' · ' + shiftName(ws, tech) + (tech.active === false ? ' · غير نشط' : '')}</Sub>
                </View>
                <Button small variant="secondary" label="تعديل" onPress={() => setTechSheet(tech.id)} />
              </Spread>
            ))
        ) : (
          <Empty text="ما فيه فنيون في هذا القسم." />
        )}
      </Card>

        </>
      ) : null}

      {section === 'meetings' ? (
        <>
      <SectionTitle title={'عناوين اجتماعات ' + year} sub="اكتب عناوينك، والتطبيق يقترحها مع الزيارات ويتابع من حضر ومن باقي." />
      <MeetingTitleAdder year={year} />
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


        </>
      ) : null}

      {section === 'backup' ? (
        <>
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
              placeholderTextColor={C.placeholder}
              style={[s.input, { minHeight: 80, marginTop: 10, textAlignVertical: 'top', paddingTop: 8, fontSize: 12 }]}
            />
            <Button style={{ marginTop: 8 }} variant="secondary" label="استيراد" disabled={!importText.trim()} onPress={importLive} />
          </Card>
          <SectionTitle title="منطقة الخطر" sub="صدّر نسخة احتياطية قبل أي مسح." />
          <Card>
          <Button
                        variant="danger"
            icon="trash-2"
            label="مسح بيانات العمل"
            onPress={() => confirm('مسح كل بيانات العمل (الفنيين والزيارات والحضور)؟ لا يمكن التراجع.', () => (store.resetLive(), ui.notify('تم مسح بيانات العمل')))}
          />
          </Card>
        </>
      ) : null}

        </>
      ) : null}

      <Sub style={{ marginTop: 14, textAlign: 'center' }}>{'ميدان · التوقيت: السعودية (UTC+3) · ' + formatDate(now.date, { weekday: true, year: true }) + ' ' + now.time}</Sub>

      <ImportSheet
        file={excel?.file ?? ''}
        preview={excel?.preview ?? null}
        onClose={() => setExcel(null)}
        onDone={(message) => {
          setExcel(null);
          ui.notify(message);
        }}
      />
      <DepartmentSheet departmentId={deptSheet} onClose={() => setDeptSheet(null)} onSaved={(m) => (setDeptSheet(null), saved(m))} />
      <TechnicianEditSheet technicianId={techSheet} onClose={() => setTechSheet(null)} onSaved={(m) => (setTechSheet(null), saved(m))} />
    </View>
  );
}

function MenuRow({ icon, title, sub, count, onPress, first, testID }: { icon: IconName; title: string; sub?: string; count?: number; onPress: () => void; first?: boolean; testID?: string }) {
  return (
    <Touch testID={testID} accessibilityRole="button" accessibilityLabel={title} feedback="select" scaleTo={0.98} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
      <IconBox name={icon} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontWeight: '700' }}>{title}</T>
        {sub ? <Sub numberOfLines={1}>{sub}</Sub> : null}
      </View>
      {count !== undefined ? <Chip tone={count ? 'purple' : 'amber'} label={count ? String(count) : 'فاضي'} /> : null}
      <Icon name="chevron-left" size={16} color={C.muted} />
    </Touch>
  );
}

/** إضافة عناوين اجتماعات: عنوان واحد، أو عدة عناوين كل واحد في سطر. */
function MeetingTitleAdder({ year }: { year: number }) {
  const apply = useApply();
  const ui = useUi();
  const [text, setText] = useState('');
  const titles = text.split(/\n|،|,/).map((item) => item.trim()).filter(Boolean);
  const add = () => {
    let added = 0;
    let skipped = 0;
    // تعديل واحد يضيف كل العناوين، والمكرر ينتخطى.
    apply((current) => {
      added = 0;
      skipped = 0;
      let next = current;
      for (const title of titles) {
        try {
          next = addMeeting(next, title, year).ws;
          added++;
        } catch {
          skipped++;
        }
      }
      return next;
    });
    setText('');
    ui.notify(added ? 'تمت إضافة ' + added + (added === 1 ? ' عنوان' : ' عناوين') + (skipped ? ' · ' + skipped + ' موجود من قبل' : '') : 'العنوان موجود من قبل');
  };
  return (
    <Card>
      <TextInput
        testID="settings-meeting-title"
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'اكتب عنوان الاجتماع\nتقدر تكتب أكثر من عنوان، كل واحد في سطر'}
        placeholderTextColor={C.placeholder}
        style={[s.input, { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 }]}
      />
      <Button testID="settings-meeting-add" style={{ marginTop: 8 }} icon="plus" label={titles.length > 1 ? 'إضافة ' + titles.length + ' عناوين' : 'إضافة العنوان'} disabled={!titles.length} onPress={add} />
    </Card>
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
      <TextInput value={value} onChangeText={setValue} style={[s.input, { flex: 1, minWidth: 0, minHeight: 38, fontSize: 14 }]} />
      <Button small variant="secondary" label="حفظ" disabled={value.trim() === title} onPress={() => onRename(value)} />
      <Button small variant="danger" label="حذف" onPress={onDelete} />
    </Row>
  );
}

function WorkScheduleCard() {
  const { ws } = useStore();
  const apply = useApply();
  const schedule = scheduleOf(ws.settings);
  const [start, setStart] = useState(schedule.start);
  const [end, setEnd] = useState(schedule.end);
  const save = (patch: Partial<typeof schedule>) =>
    apply((c) => ({ ...c, settings: { ...c.settings, workSchedule: { ...scheduleOf(c.settings), ...patch } } }));
  return (
    <Card>
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 6 }}>أيام الدوام</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {WEEKDAYS_AR.map((name, day) => {
          const on = schedule.days.includes(day);
          return (
            <Touch
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => save({ days: on ? schedule.days.filter((d) => d !== day) : [...schedule.days, day].sort() })}
              style={{ paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderRadius: 10, backgroundColor: on ? C.purple : C.white, borderWidth: 1, borderColor: on ? C.purple : C.line }}
            >
              <T style={{ color: on ? C.onAccent : C.ink, fontSize: 14 }}>{name}</T>
            </Touch>
          );
        })}
      </View>
      <Row style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Field testID="work-start" label="من" value={start} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={(v) => (setStart(v), isTime(v) && save({ start: v }))} />
        </View>
        <View style={{ flex: 1 }}>
          <Field testID="work-end" label="إلى" value={end} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={(v) => (setEnd(v), isTime(v) && save({ end: v }))} />
        </View>
      </Row>
      <Sub>{'هدف الأسبوع = الهدف اليومي × ' + schedule.days.length + ' أيام. الإجازة ما تكسر سلسلة الإنجاز.'}</Sub>
    </Card>
  );
}

function PlacesCard() {
  const { ws } = useStore();
  const apply = useApply();
  const ui = useUi();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceKind>('warehouse');
  const places = placesOf(ws);
  return (
    <Card>
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
          testID="new-place-name"
          value={name}
          onChangeText={setName}
          placeholder={PLACE_HINT[kind]}
          placeholderTextColor={C.placeholder}
          style={[s.input, { flex: 1, minWidth: 0 }]}
        />
        <Button
          testID="add-place"
          icon="plus"
          label="إضافة"
          disabled={!name.trim()}
          onPress={() => {
            const error = apply((c) => addPlace(c, { kind, name }));
            if (error) return ui.notify(error);
            setName('');
            ui.notify('تمت إضافة ' + PLACE_NOUN[kind]);
          }}
        />
      </Row>
      {places.map((place, index) => (
        <Spread key={place.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line, marginTop: index ? 0 : 8 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>{place.name}</T>
            <Sub>{PLACE_NOUN[place.kind]}</Sub>
          </View>
          <Button small variant="danger" label="حذف" onPress={() => confirm('حذف «' + place.name + '»؟ زياراته السابقة تبقى في السجل.', () => apply((c) => deletePlace(c, place.id)))} />
        </Spread>
      ))}
    </Card>
  );
}
