import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatDate, MONTHS_AR, normalizeDigits } from '../domain/dates';
import type { FindingRow, FindingsDetail } from '../domain/findings';
import { FINDING_KINDS, FINDING_NOUN, FINDING_PLURAL, STATUS_LABEL } from '../domain/findings';
import { findingStatRows, buildReport, REPORT_MODES, ReportMode, ReportParams, reportCsv, reportFileName, reportHtml } from '../domain/reports';
import { shiftName, techTag } from '../domain/shifts';
import { searchTechnicians, techProgress, tone } from '../domain/stats';
import { sharePdf, shareText } from '../exporting';
import { formatDuration } from '../domain/worktime';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Progress, ratio, Row, s, SectionTitle, Segmented, Spread, Stepper, Sub, T } from '../ui/kit';
import { CHART, ColumnChart, ProgressRows, StackedBar } from '../ui/charts';
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
  const [view, setView] = useState<'summary' | 'coverage' | 'pending' | 'follow'>('summary');
  const [busy, setBusy] = useState(false);
  const report = useMemo(() => buildReport(ws, params, now.date), [ws, params, now.date]);
  const set = (patch: Partial<ReportParams>) => setParams((prev) => ({ ...prev, ...patch }));
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
      <EmployeeSearch />

      <SectionTitle title="التقرير" sub="اختر الفترة والقسم." />
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

      <View style={{ marginBottom: 12 }}>
        <Segmented
          options={[
            { value: 'summary', label: 'الإنجاز' },
            { value: 'coverage', label: 'التغطية' },
            { value: 'pending', label: 'من باقي' },
            { value: 'follow', label: 'الملاحظات' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'summary' ? (
        <>
      <Card>
        <T style={{ fontWeight: '800', fontSize: 16 }}>{report.label + ' · ' + report.scopeLabel}</T>
        <Sub>{'من ' + formatDate(report.start) + ' إلى ' + formatDate(report.last) + ' · من السجلات المحفوظة'}</Sub>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Kpi half testID="kpi-visits" label="زيارات" value={report.totals.visits} hint="الزيارة الجماعية = 1" />
          <Kpi half label="زيارات الفنيين" value={report.totals.technicianVisits} hint={report.totals.techniciansVisited + ' فني مختلف'} />
          <Kpi half testID="kpi-meetings" label="تسجيلات اجتماعات" value={report.totals.meetingSessions} hint={report.totals.meetingsHeld + ' اجتماع مختلف'} />
          <Kpi half label="مرات حضور" value={report.totals.attendance} />
        </View>
        {!report.totals.visits && !report.totals.meetingSessions ? <Sub style={{ marginTop: 8 }}>ما فيه إنجاز مسجل لهذه الفترة.</Sub> : null}

        <T style={{ fontWeight: '800', marginTop: 16, marginBottom: 6 }}>{params.mode === 'month' ? 'الإنجاز أسبوعًا بأسبوع' : 'الإنجاز شهرًا بشهر'}</T>
        <View testID="chart-period">
          <ColumnChart
            series={[
              { name: 'زيارات', color: CHART.visits },
              { name: 'اجتماعات', color: CHART.meetings },
            ]}
            buckets={report.buckets.map((bucket) => ({ label: bucket.label, values: [bucket.visits, bucket.meetingSessions] }))}
          />
        </View>
        <Sub style={{ marginTop: 4 }}>اضغط على أي عمود لعرض أرقامه.</Sub>

        <T style={{ fontWeight: '800', marginTop: 14, marginBottom: 4 }}>التوزيع حسب القسم</T>
        <Table
          head={['القسم', 'زيارات', 'زيارات فنيين', 'اجتماعات', 'حضور']}
          rows={report.sections.map((row) => [row.name, row.visits, row.technicianVisits, row.meetingSessions, row.attendance])}
        />
        <Sub style={{ marginTop: 8 }}>الزيارة تُحسب مرة واحدة في التقرير ولو شملت أكثر من فني، وتُحسب زيارة لكل فني في سجله.</Sub>
      </Card>

        </>
      ) : null}

      {view === 'follow' ? (
        <>
      <SectionTitle title="الملاحظات والمخالفات وLSR وخارج الدوام" sub={'المسجلة في ' + report.label} />
      <View testID="report-follow">
        <Card>
          <Table
            head={['', 'مفتوحة', 'متأخرة', 'مقفلة', 'إغلاق (يوم)']}
            rows={findingStatRows(report)}
          />
          <T style={{ fontWeight: '700', marginTop: 12 }}>العمل خارج الدوام</T>
          <Row gap={8} style={{ marginTop: 6 }}>
            <Kpi label="مرات مسجلة" value={report.overtime.entries} hint={formatDuration(report.overtime.minutes)} />
            <Kpi label="نشاط خارج الدوام" value={report.overtime.outOfHoursActivities} hint={report.overtime.days + ' يوم'} />
          </Row>
        </Card>
      </View>

      <SectionTitle title="الملاحظات والمخالفات وLSR بالأسماء" sub={'المسجلة في ' + report.label + ' · ' + report.scopeLabel} />
      <FindingsByName detail={report.findingsDetail} />

        </>
      ) : null}

      {view === 'coverage' ? (
        <>
      <SectionTitle title="صورة التغطية" sub={'حالة الفنيين حتى ' + formatDate(report.asOf, { year: true }) + ' · ' + report.scopeLabel} />
      <Card>
        <StackedBar
          testID="chart-visit-status"
          title={'الزيارات (الهدف ' + ws.settings.visitTarget + ' خلال ' + ws.settings.visitWindowMonths + ' أشهر)'}
          segments={[
            { label: 'بدون زيارة', value: report.statusMix.visits.none, color: CHART.critical, icon: 'x-circle' },
            { label: 'جزئي', value: report.statusMix.visits.partial, color: CHART.warning, icon: 'alert-circle' },
            { label: 'مكتمل', value: report.statusMix.visits.complete, color: CHART.good, icon: 'check-circle' },
          ]}
        />
        {report.meetingTitles.length ? (
          <StackedBar
            testID="chart-meeting-status"
            title={'الاجتماعات (' + report.meetingTitles.length + ' هالسنة)'}
            segments={[
              { label: 'ما حضر', value: report.statusMix.meetings.none, color: CHART.critical, icon: 'x-circle' },
              { label: 'جزئي', value: report.statusMix.meetings.partial, color: CHART.warning, icon: 'alert-circle' },
              { label: 'حضر الكل', value: report.statusMix.meetings.complete, color: CHART.good, icon: 'check-circle' },
            ]}
          />
        ) : null}
        <T style={{ fontWeight: '800', marginTop: 4, marginBottom: 8 }}>نسبة من أكمل الزيارات حسب القسم</T>
        <ProgressRows
          testID="chart-dept-visits"
          color={CHART.visits}
          rows={report.coverage.map((dept) => ({ label: dept.department.name, done: dept.coverage.visitComplete, total: dept.coverage.fieldPeople }))}
        />
        {report.meetingTitles.length ? (
          <>
            <T style={{ fontWeight: '800', marginTop: 4, marginBottom: 8 }}>نسبة من حضر كل الاجتماعات حسب القسم</T>
            <ProgressRows
              color={CHART.meetings}
              rows={report.coverage.map((dept) => ({ label: dept.department.name, done: dept.coverage.meetingComplete, total: dept.coverage.people }))}
            />
          </>
        ) : null}
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
            <Metric label="الزيارات" remaining={dept.coverage.visitRemaining} total={dept.coverage.fieldPeople * ws.settings.visitTarget} />
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

        </>
      ) : null}

      {view === 'pending' ? (
        <>
      <SectionTitle title="من باقي عليه" sub={report.pending.length ? 'مرتبة حسب الأكثر احتياجًا للزيارات ثم الحضور · ' + report.pending.length + ' فني' : 'اكتملت تغطية جميع الفنيين'} />
      <Card style={{ paddingVertical: 4 }}>
        {report.pending.length ? (
          (showAll ? report.pending : report.pending.slice(0, 8)).map((row, index) => (
            <Spread key={row.technician.id} style={{ paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 13 }}>{row.technician.name}</T>
                <Sub>{row.departmentName + ' · ' + row.shiftName + ' · ' + techTag(row.technician)}</Sub>
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
        </>
      ) : null}


    </View>
  );
}

function EmployeeSearch() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const matches = searched ? searchTechnicians(ws, searched) : [];
  const tech = matches.length === 1 ? matches[0] : matches.find((item) => item.id === picked);
  const progress = tech ? techProgress(ws, tech, now.date) : null;
  const allVisits = tech ? ws.visits.filter((v) => v.technicianIds.includes(tech.id)).length : 0;
  const search = () => {
    setSearched(normalizeDigits(query));
    setPicked(null);
  };
  const example = ws.technicians.find((t) => t.employeeNumber)?.employeeNumber;

  return (
    <>
      <SectionTitle title="البحث عن موظف" sub="بالرقم الوظيفي أو الاسم: يعرض سجله من زيارات واجتماعات" />
      <Card>
        <Row>
          <TextInput
            testID="employee-search"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder={example ? 'الرقم الوظيفي أو الاسم، مثل ' + example : 'الرقم الوظيفي أو الاسم'}
            placeholderTextColor={C.placeholder}
            style={[s.input, { flex: 1, minWidth: 0 }]}
          />
          <Button testID="employee-search-go" label="بحث" icon="search" onPress={search} disabled={!query.trim()} />
        </Row>
        {!searched ? null : !matches.length ? (
          <Sub style={{ marginTop: 10 }}>ما فيه موظف بهذا الرقم أو الاسم.</Sub>
        ) : !tech || !progress ? (
          <View style={{ marginTop: 8 }}>
            <Sub>{matches.length + ' نتيجة، اختر الموظف:'}</Sub>
            {matches.map((item, index) => (
              <Button
                key={item.id}
                small
                variant="ghost"
                label={item.name + (item.employeeNumber ? ' · ' + item.employeeNumber : '')}
                onPress={() => setPicked(item.id)}
                style={{ justifyContent: 'flex-start', borderTopWidth: index ? 1 : 0, borderTopColor: C.line, borderRadius: 0 }}
              />
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
            <Spread>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '800', fontSize: 16 }}>{tech.name}</T>
                <Sub>
                  {techTag(tech, true) + ' · ' + (ws.departments.find((d) => d.id === tech.departmentId)?.name ?? '—') + ' · ' + shiftName(ws, tech) + (tech.active === false ? ' · غير نشط' : '')}
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

function FindingsByName({ detail }: { detail: FindingsDetail }) {
  const [list, setList] = useState<'open' | 'closed'>('open');
  const [all, setAll] = useState(false);
  const rows = detail[list];
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <View testID="report-findings">
      <Card>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>حسب الفني</T>
        {detail.byTechnician.length ? (
          <>
            <Table
              head={['الفني / الفريق', ...FINDING_KINDS.map((kind) => FINDING_PLURAL[kind])]}
              rows={detail.byTechnician.map((row) => [row.technician.name, ...FINDING_KINDS.map((kind) => '\u2066' + row[kind].open + ' / ' + row[kind].closed + '\u2069')])}
            />
            <Sub style={{ marginTop: 6 }}>الرقم: باقية / مقفلة</Sub>
          </>
        ) : (
          <Sub>ما فيه ملاحظات مربوطة بفنيين في هالفترة. اختر الفنيين المعنيين وقت تسجيل الملاحظة أو المخالفة.</Sub>
        )}
        {detail.unlinked ? <Sub style={{ marginTop: 6 }}>{detail.unlinked + ' بدون فني محدد'}</Sub> : null}
      </Card>
      <Card>
        <Segmented
          options={[
            { value: 'open', label: 'الباقية · ' + detail.open.length },
            { value: 'closed', label: 'المقفلة · ' + detail.closed.length },
          ]}
          value={list}
          onChange={(value) => {
            setList(value);
            setAll(false);
          }}
        />
        <View style={{ marginTop: 8 }}>
          {shown.map((row) => (
            <FindingLine key={row.finding.id} row={row} />
          ))}
          {!rows.length ? <Empty text={list === 'open' ? 'ما فيه شي باقي 👍' : 'ما انقفل شي في هالفترة'} /> : null}
        </View>
        {rows.length > shown.length || all ? (
          <Button small variant="ghost" label={all ? 'عرض أقل' : 'عرض الكل (' + rows.length + ')'} onPress={() => setAll(!all)} />
        ) : null}
      </Card>
    </View>
  );
}

function FindingLine({ row }: { row: FindingRow }) {
  const closed = row.finding.status === 'closed';
  return (
    <View testID={'report-finding-' + row.finding.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 8 }}>
      <Spread style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={{ fontWeight: '700' }}>{row.finding.title}</T>
          {row.finding.extra?.rule ? <Sub style={{ color: C.red }}>{'القاعدة: ' + row.finding.extra.rule}</Sub> : null}
          <Sub numberOfLines={2}>{[row.names.join('، ') || 'بدون فني محدد', row.departmentName, row.finding.location].filter(Boolean).join(' · ')}</Sub>
        </View>
        <Chip tone={row.finding.kind === 'observation' ? 'purple' : 'red'} label={FINDING_NOUN[row.finding.kind]} />
      </Spread>
      <Sub style={{ marginTop: 2, color: closed ? C.green : row.overdue ? C.red : C.amber }}>
        {closed
          ? 'انقفلت ' + formatDate(row.finding.closedAt ?? row.finding.date) + ' بعد ' + row.age + ' يوم'
          : (row.overdue ? 'متأخرة · ' : row.finding.status === 'progress' ? STATUS_LABEL.progress + ' · ' : '') + (row.age ? 'مفتوحة من ' + row.age + ' يوم' : 'انسجلت اليوم')}
      </Sub>
    </View>
  );
}

function Kpi({ label, value, hint, testID, half }: { label: string; value: number; hint?: string; testID?: string; half?: boolean }) {
  return (
    <View testID={testID} style={{ flexBasis: half ? '46%' : 0, flexGrow: 1, minWidth: 0, backgroundColor: C.subtle, borderRadius: 12, padding: 9 }}>
      <Sub style={{ fontSize: 11 }}>{label}</Sub>
      <T style={{ fontSize: 20, fontWeight: '800' }}>{value}</T>
      {hint ? <Sub style={{ fontSize: 10 }}>{hint}</Sub> : null}
    </View>
  );
}

function Metric({ label, remaining, total, done }: { label: string; remaining: number; total: number; done?: number }) {
  const completed = done ?? total - remaining;
  return (
    <View style={{ flex: 1, backgroundColor: C.subtle, borderRadius: 10, padding: 8 }}>
      <Sub style={{ fontSize: 11 }}>{label}</Sub>
      <T style={{ fontSize: 16, fontWeight: '800' }}>{remaining + ' متبقية'}</T>
      <Progress value={Math.min(completed, total)} max={total} height={5} />
      <Sub style={{ fontSize: 11 }}>{ratio(completed, total) + ' مكتملة'}</Sub>
    </View>
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
