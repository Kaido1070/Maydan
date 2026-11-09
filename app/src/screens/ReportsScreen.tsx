import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatDate, MONTHS_AR, normalizeDigits } from '../domain/dates';
import { buildReport, REPORT_MODES, ReportMode, ReportParams, reportCsv, reportFileName, reportHtml } from '../domain/reports';
import { shiftName } from '../domain/shifts';
import { findByEmployeeNumber, techProgress, tone } from '../domain/stats';
import { sharePdf, shareText } from '../exporting';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Progress, ratio, Row, s, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { TechDetails } from '../ui/TechRow';
import { useUi } from '../ui/ui';

export function ReportsScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [params, setParams] = useState<ReportParams>(() => ({
    mode: 'month',
    year: Number(now.date.slice(0, 4)),
    month: Number(now.date.slice(5, 7)) - 1,
    quarter: Math.floor((Number(now.date.slice(5, 7)) - 1) / 3),
    departmentId: 'all',
  }));
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const report = useMemo(() => buildReport(ws, params, now.date), [ws, params, now.date]);
  const set = (patch: Partial<ReportParams>) => setParams((prev) => ({ ...prev, ...patch }));
  const peak = Math.max(1, ...report.buckets.map((b) => Math.max(b.visits, b.meetingSessions)));
  const currentYear = Number(now.date.slice(0, 4));

  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(true);
    try {
      if (kind === 'csv') await shareText(reportFileName(report, 'csv'), reportCsv(report), 'text/csv', 'public.comma-separated-values-text');
      else await sharePdf(reportFileName(report, 'pdf'), reportHtml(report, ws.settings.engineerName));
    } catch (error) {
      ui.notify('تعذر التصدير: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  };

  const total = report.coverage.reduce(
    (sum, dept) => ({
      people: sum.people + dept.coverage.people,
      visits: sum.visits + dept.coverage.visitRemaining,
      attendance: sum.attendance + dept.coverage.attendanceRemaining,
      complete: sum.complete + dept.coverage.complete,
    }),
    { people: 0, visits: 0, attendance: 0, complete: 0 },
  );

  return (
    <View>
      <SectionTitle title="تقرير الإنجاز حسب الفترة" sub="اختر الفترة والقسم لمراجعة النشاط المسجل والمتبقي." />
      <Card style={{ gap: 10 }}>
        <Segmented options={(Object.keys(REPORT_MODES) as ReportMode[]).map((mode) => ({ value: mode, label: REPORT_MODES[mode] }))} value={params.mode} onChange={(mode) => set({ mode })} />
        <Spread>
          <T style={{ fontWeight: '700', fontSize: 12 }}>السنة</T>
          <Stepper label={String(params.year)} onPrev={() => set({ year: params.year - 1 })} onNext={() => set({ year: params.year + 1 })} nextDisabled={params.year >= currentYear} />
        </Spread>
        {params.mode === 'month' ? (
          <Spread>
            <T style={{ fontWeight: '700', fontSize: 12 }}>الشهر</T>
            <Stepper
              label={MONTHS_AR[params.month]}
              onPrev={() => (params.month ? set({ month: params.month - 1 }) : set({ month: 11, year: params.year - 1 }))}
              onNext={() => (params.month < 11 ? set({ month: params.month + 1 }) : set({ month: 0, year: params.year + 1 }))}
            />
          </Spread>
        ) : null}
        {params.mode === 'quarter' ? (
          <Segmented options={[0, 1, 2, 3].map((q) => ({ value: q, label: 'الربع ' + (q + 1) }))} value={params.quarter} onChange={(quarter) => set({ quarter })} />
        ) : null}
        <Segmented wrap options={[{ value: 'all', label: 'كل الأقسام' }, ...ws.departments.map((d) => ({ value: d.id, label: d.name }))]} value={params.departmentId} onChange={(departmentId) => set({ departmentId })} />
        <Row>
          <Button testID="export-csv" style={{ flex: 1 }} variant="secondary" icon="file-text" label="تصدير CSV" disabled={busy} onPress={() => run('csv')} />
          <Button testID="export-pdf" style={{ flex: 1 }} variant="secondary" icon="printer" label="تصدير PDF" disabled={busy} onPress={() => run('pdf')} />
        </Row>
      </Card>

      <Card>
        <T style={{ fontWeight: '800', fontSize: 16 }}>{report.label + ' · ' + report.scopeLabel}</T>
        <Sub>{'من ' + formatDate(report.start) + ' إلى ' + formatDate(report.last) + ' · من السجلات المحفوظة'}</Sub>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Kpi testID="kpi-visits" label="زيارات" value={report.totals.visits} hint="الزيارة الجماعية = 1" />
          <Kpi label="زيارات الفنيين" value={report.totals.technicianVisits} hint={report.totals.techniciansVisited + ' فني مختلف'} />
          <Kpi testID="kpi-meetings" label="تسجيلات اجتماعات" value={report.totals.meetingSessions} hint={report.totals.meetingsHeld + ' اجتماع مختلف'} />
          <Kpi label="مرات حضور" value={report.totals.attendance} />
        </View>
        {!report.totals.visits && !report.totals.meetingSessions ? <Sub style={{ marginTop: 8 }}>ما فيه إنجاز مسجل لهذه الفترة.</Sub> : null}

        <T style={{ fontWeight: '800', marginTop: 14 }}>الإنجاز عبر الفترة</T>
        <Row gap={10} style={{ marginTop: 4 }}>
          <Chip tone="purple" label="زيارات" />
          <Chip tone="green" label="اجتماعات" />
        </Row>
        {report.buckets.map((bucket) => (
          <Row key={bucket.start} style={{ marginTop: 6 }}>
            <Sub style={{ width: 62 }}>{bucket.label}</Sub>
            <View style={{ flex: 1 }}>
              <Bar value={bucket.visits} peak={peak} color="#7653e2" />
              <Bar value={bucket.meetingSessions} peak={peak} color="#278969" />
            </View>
          </Row>
        ))}

        <T style={{ fontWeight: '800', marginTop: 14, marginBottom: 4 }}>التوزيع حسب القسم</T>
        <Table
          head={['القسم', 'زيارات', 'زيارات فنيين', 'اجتماعات', 'حضور']}
          rows={report.sections.map((row) => [row.name, row.visits, row.technicianVisits, row.meetingSessions, row.attendance])}
        />
        <Sub style={{ marginTop: 8 }}>الزيارة تُحسب مرة واحدة في التقرير ولو شملت أكثر من فني، وتُحسب زيارة لكل فني في سجله.</Sub>
      </Card>

      <SectionTitle title="المتبقي على كل قسم وشفت" sub={'محسوب حتى ' + formatDate(report.asOf, { year: true }) + ' · الزيارات لآخر ' + ws.settings.visitWindowMonths + ' أشهر والاجتماعات لسنة ' + report.asOf.slice(0, 4)} />
      <Row gap={8} style={{ marginBottom: 10 }}>
        <Kpi label="زيارات متبقية" value={total.visits} />
        <Kpi label="حضور متبقٍ" value={total.attendance} />
        <Kpi label="مكتملون" value={total.complete} hint={'من ' + total.people} />
      </Row>
      {report.coverage.map((dept) => (
        <Card key={dept.department.id}>
          <Spread>
            <T style={{ fontWeight: '800', fontSize: 16 }}>{dept.department.name}</T>
            <Sub>{dept.coverage.people + ' فني'}</Sub>
          </Spread>
          <Row gap={8} style={{ marginTop: 8 }}>
            <Metric label="الزيارات" remaining={dept.coverage.visitRemaining} total={dept.coverage.people * ws.settings.visitTarget} />
            <Metric label="مرات الحضور" remaining={dept.coverage.attendanceRemaining} total={dept.coverage.people * report.meetingTitles.length} />
          </Row>
          {report.meetingTitles.length ? (
            <Row gap={4} style={{ flexWrap: 'wrap', marginVertical: 8 }}>
              {report.meetingTitles.map((title, index) => {
                const missing = dept.coverage.missingByMeeting[index] ?? 0;
                return <Chip key={title} tone={tone(dept.coverage.people - missing, dept.coverage.people)} label={title + ' · ' + (missing ? 'ناقص ' + missing : 'مكتمل')} />;
              })}
            </Row>
          ) : null}
          <Table
            head={['الشفت', 'الفنيون', 'زيارات', 'حضور', 'الحالة']}
            rows={dept.shifts.map((row) => [
              row.shift.name,
              row.coverage.people,
              row.coverage.visitRemaining,
              row.coverage.attendanceRemaining,
              !row.coverage.people ? '—' : row.coverage.visitRemaining + row.coverage.attendanceRemaining ? 'غير مكتمل' : 'مكتمل',
            ])}
          />
        </Card>
      ))}

      <SectionTitle title="من باقي عليه" sub={report.pending.length ? 'مرتبة حسب الأكثر احتياجًا للزيارات ثم الحضور · ' + report.pending.length + ' فني' : 'اكتملت تغطية جميع الفنيين'} />
      <Card style={{ paddingVertical: 4 }}>
        {report.pending.length ? (
          (showAll ? report.pending : report.pending.slice(0, 8)).map((row, index) => (
            <Spread key={row.technician.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 13 }}>{row.technician.name}</T>
                <Sub>{row.departmentName + ' · ' + row.shiftName + ' · ' + row.technician.employeeNumber}</Sub>
                {row.missingMeetings.length ? <Sub numberOfLines={2}>{'ناقص: ' + row.missingMeetings.map((m) => m.title).join('، ')}</Sub> : null}
              </View>
              <View style={{ gap: 3, alignItems: 'flex-end' }}>
                <Chip tone={tone(ws.settings.visitTarget - row.visitRemaining, ws.settings.visitTarget)} label={'زيارات متبقية ' + row.visitRemaining} />
                <Chip tone={tone(row.meetingTarget - row.meetingRemaining, row.meetingTarget)} label={'حضور متبقٍ ' + row.meetingRemaining} />
              </View>
            </Spread>
          ))
        ) : (
          <Empty text="لا يوجد متبقٍ." />
        )}
        {report.pending.length > 8 ? <Button small variant="ghost" label={showAll ? 'عرض أقل' : 'عرض باقي الفنيين · ' + (report.pending.length - 8)} onPress={() => setShowAll(!showAll)} /> : null}
      </Card>

      <EmployeeSearch />
    </View>
  );
}

function EmployeeSearch() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const tech = searched ? findByEmployeeNumber(ws, searched) : undefined;
  const progress = tech ? techProgress(ws, tech, now.date) : null;
  const allVisits = tech ? ws.visits.filter((v) => v.technicianIds.includes(tech.id)).length : 0;
  const search = () => setSearched(normalizeDigits(query));
  const example = ws.technicians[0]?.employeeNumber;

  return (
    <>
      <SectionTitle title="البحث بالرقم الوظيفي" sub="يعرض سجل الموظف من زيارات واجتماعات" />
      <Card>
        <Row>
          <TextInput
            testID="employee-search"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            keyboardType="number-pad"
            returnKeyType="search"
            placeholder={example ? 'مثال: ' + example : 'الرقم الوظيفي'}
            placeholderTextColor="#a29db3"
            style={[s.input, { flex: 1, minWidth: 0 }]}
          />
          <Button testID="employee-search-go" label="بحث" icon="search" onPress={search} disabled={!query.trim()} />
        </Row>
        {!searched ? null : !tech || !progress ? (
          <Sub style={{ marginTop: 10 }}>ما فيه موظف بهذا الرقم الوظيفي.</Sub>
        ) : (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
            <Spread>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '800', fontSize: 16 }}>{tech.name}</T>
                <Sub>
                  {'الرقم الوظيفي ' + tech.employeeNumber + ' · ' + (ws.departments.find((d) => d.id === tech.departmentId)?.name ?? '—') + ' · ' + shiftName(ws, tech) + (tech.active === false ? ' · غير نشط' : '')}
                </Sub>
              </View>
              <Button small variant="secondary" label="نقل/تكليف" onPress={() => ui.openTechnician(tech.id)} />
            </Spread>
            <Row gap={8} style={{ marginTop: 8 }}>
              <Metric label="الزيارات (6 أشهر)" remaining={progress.visitRemaining} total={ws.settings.visitTarget} done={progress.visitCount} />
              <Metric label="الاجتماعات" remaining={progress.meetingRemaining} total={progress.meetingTarget} />
            </Row>
            <Sub style={{ marginTop: 6 }}>{'إجمالي الزيارات المسجلة لهذا الفني: ' + allVisits}</Sub>
            <TechDetails ws={ws} tech={tech} asOf={now.date} />
          </View>
        )}
      </Card>
    </>
  );
}

function Kpi({ label, value, hint, testID }: { label: string; value: number; hint?: string; testID?: string }) {
  return (
    <View testID={testID} style={{ flexBasis: '46%', flexGrow: 1, backgroundColor: '#f7f5fb', borderRadius: 12, padding: 9 }}>
      <Sub style={{ fontSize: 11 }}>{label}</Sub>
      <T style={{ fontSize: 20, fontWeight: '800' }}>{value}</T>
      {hint ? <Sub style={{ fontSize: 10 }}>{hint}</Sub> : null}
    </View>
  );
}

function Metric({ label, remaining, total, done }: { label: string; remaining: number; total: number; done?: number }) {
  const completed = done ?? total - remaining;
  return (
    <View style={{ flex: 1, backgroundColor: '#f7f5fb', borderRadius: 10, padding: 8 }}>
      <Sub style={{ fontSize: 11 }}>{label}</Sub>
      <T style={{ fontSize: 16, fontWeight: '800' }}>{remaining + ' متبقية'}</T>
      <Progress value={Math.min(completed, total)} max={total} height={5} />
      <Sub style={{ fontSize: 11 }}>{ratio(completed, total) + ' مكتملة'}</Sub>
    </View>
  );
}

function Bar({ value, peak, color }: { value: number; peak: number; color: string }) {
  return (
    <Row gap={5}>
      <View style={{ flex: 1, height: 7, backgroundColor: '#eeeaf6', borderRadius: 99, overflow: 'hidden', marginVertical: 2 }}>
        <View style={{ width: `${(100 * value) / peak}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
      </View>
      <T style={{ fontSize: 11, fontWeight: '700', minWidth: 18 }}>{value}</T>
    </Row>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <View>
      <Row gap={0} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 5 }}>
        {head.map((cell, index) => (
          <Sub key={cell} style={{ flex: index ? 1 : 1.6, fontWeight: '700', fontSize: 11, textAlign: index ? 'center' : undefined }}>
            {cell}
          </Sub>
        ))}
      </Row>
      {rows.map((row, r) => (
        <Row key={r} gap={0} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }}>
          {row.map((cell, index) => (
            <T key={index} style={{ flex: index ? 1 : 1.6, fontSize: 12, textAlign: index ? 'center' : undefined, fontWeight: index ? '400' : '700' }}>
              {cell}
            </T>
          ))}
        </Row>
      ))}
      {!rows.length ? <Empty text="لا توجد بيانات" /> : null}
    </View>
  );
}
