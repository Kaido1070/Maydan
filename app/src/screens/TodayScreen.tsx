import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { addDays, formatDate } from '../domain/dates';
import { plannedVisit, tasksOn } from '../domain/plan';
import { activeTechnicians, currentSlot, periodRange, shiftLabel } from '../domain/shifts';
import { coverageOf, dayProgress, followUpList, technicianVisits, tone, xpSummary } from '../domain/stats';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Icon, IconBox, Progress, ratio, Row, SectionTitle, Spread, Stepper, Sub, T } from '../ui/kit';
import { TechRow } from '../ui/TechRow';
import { useUi } from '../ui/ui';

const WINDOW = 7;

export function TodayScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [offset, setOffset] = useState(0);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const date = addDays(now.date, offset);
  const tasks = tasksOn(ws, date);
  const xp = xpSummary(ws);
  const today = dayProgress(ws, now.date);
  const todayTasks = tasksOn(ws, now.date);
  const meetingGoal = todayTasks.filter((task) => task.item.kind === 'meeting').length;
  const meetingsDone = todayTasks.filter((task) => task.item.kind === 'meeting' && task.done).length;
  const name = ws.settings.engineerName.trim();
  const overall = coverageOf(ws, activeTechnicians(ws), now.date).coverage;
  const followUps = followUpList(ws, now.date);
  const priority = ws.departments.flatMap((department) =>
    (currentSlot(ws, department, now)?.crew ?? [])
      .filter((tech) => !technicianVisits(ws, tech.id, now.date).length)
      .map((tech) => ({ tech, department })),
  );

  const heroText =
    today.visits >= today.goal
      ? 'أكملت هدف الزيارات اليوم. تقدر تراجع سجل الفرق أو تسجل اجتماعك.'
      : 'هدفك اليوم ' + today.goal + ' زيارات ميدانية. كل زيارة تسجلها تقربك من المستوى التالي.';

  return (
    <View>
      <View style={{ backgroundColor: '#4a2f9a', borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Row gap={5}>
            <Icon name="zap" size={13} color="#e0d1ff" />
            <T style={{ color: '#e0d1ff', fontSize: 11, fontWeight: '700' }}>بطاقة الإنجاز الميداني</T>
          </Row>
          <T style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginVertical: 4 }}>{name ? 'مهامك الميدانية يا ' + name : 'مهامك الميدانية'}</T>
          <T style={{ color: '#eee5ff', fontSize: 12, lineHeight: 19 }}>{heroText}</T>
        </View>
        <View style={{ width: 108, padding: 10, borderRadius: 14, backgroundColor: '#2a1a5a', borderWidth: 1, borderColor: '#ffffff2d' }}>
          <Spread>
            <T style={{ color: '#fff', fontSize: 11 }}>المستوى</T>
            <T style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{xp.level}</T>
          </Spread>
          <Progress value={xp.levelXp} max={100} color="#d4c0ff" track="#ffffff2b" />
          <T style={{ color: '#e3d7ff', fontSize: 10 }}>{'⁦' + xp.levelXp + ' / 100 XP⁩'}</T>
        </View>
      </View>

      <Row style={{ marginTop: 10 }} gap={8}>
        <Stat icon="map-pin" label="زيارات اليوم" value={ratio(today.visits, today.goal)} tone={tone(today.visits, today.goal)} />
        <Stat icon="check" label="مهام مكتملة" value={ratio(tasks.filter((t) => t.done).length, tasks.length)} />
        <Stat icon="zap" label="إجمالي الخبرة" value={'⁦' + xp.xp + ' XP⁩'} />
      </Row>

      <Card style={{ marginTop: 10 }}>
        <Row>
          <IconBox name="target" />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '800', fontSize: 15 }}>تحدي اليوم</T>
            <Sub>{today.visits >= today.goal && meetingsDone >= meetingGoal ? 'حققت هدف اليوم 🎉' : 'تابع إنجازك خطوة بخطوة'}</Sub>
          </View>
        </Row>
        <Spread style={{ marginTop: 10 }}>
          <T style={{ fontSize: 13 }}>زيارات ميدانية</T>
          <T style={{ fontWeight: '800' }}>{ratio(today.visits, today.goal)}</T>
        </Spread>
        <Progress value={today.visits} max={today.goal} />
        {meetingGoal ? (
          <>
            <Spread>
              <T style={{ fontSize: 13 }}>اجتماعات مجدولة</T>
              <T style={{ fontWeight: '800' }}>{ratio(meetingsDone, meetingGoal)}</T>
            </Spread>
            <Progress value={meetingsDone} max={meetingGoal} color="#278969" />
          </>
        ) : null}
        <Button testID="quick-visit" style={{ marginTop: 6 }} icon="plus" label="تسجيل زيارة" onPress={() => ui.go('visits')} variant="secondary" />
      </Card>

      <SectionTitle
        title={offset === 0 ? 'جدول أعمال اليوم' : 'جدول ' + formatDate(date, { weekday: true })}
        sub="لون الشفت يعكس أقل سجل بين فنييه"
        right={<Stepper label={formatDate(date)} onPrev={() => setOffset(offset - 1)} onNext={() => setOffset(offset + 1)} prevDisabled={offset <= -WINDOW} nextDisabled={offset >= WINDOW} />}
      />
      <Card style={{ paddingVertical: 4 }}>
        {tasks.length ? (
          tasks.map((task, index) => {
            const visit = task.item.kind === 'visit';
            const future = task.date > now.date;
            const minVisits = Math.min(...(task.slot?.crew ?? []).map((tech) => technicianVisits(ws, tech.id, task.date).length), Infinity);
            return (
              <View key={task.item.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <IconBox name={visit ? 'map-pin' : 'calendar'} tone={visit ? 'purple' : 'amber'} size={34} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <T style={{ fontWeight: '700' }}>{task.item.title}</T>
                    <Chip tone={visit ? 'purple' : 'amber'} label={visit ? 'زيارة' : 'اجتماع'} />
                  </Row>
                  <Sub>{task.department.name + ' · ' + shiftLabel(task.slot) + ' · ' + task.item.time}</Sub>
                  {task.slot?.crew.length ? (
                    <Chip tone={tone(minVisits, ws.settings.visitTarget)} label={task.slot.crew.length + ' فني · أقل سجل زيارات ' + ratio(minVisits, ws.settings.visitTarget)} />
                  ) : (
                    <Sub>حدد الفنيين من جدول الشفتات</Sub>
                  )}
                </View>
                <View style={{ alignItems: 'center', gap: 3 }}>
                  <Button
                    small
                    testID={'task-' + task.item.id}
                    variant={task.done ? 'done' : future ? 'secondary' : 'primary'}
                    disabled={future}
                    label={task.done ? 'تم الإنجاز' : future ? 'قادمة' : 'سجل الإنجاز'}
                    onPress={() => {
                      if (!visit) return ui.go('meetings', { departmentId: task.department.id, meetingId: task.item.meetingId });
                      const existing = plannedVisit(ws, task.item, task.date);
                      ui.openVisit(existing ? { departmentId: task.department.id, visitId: existing.id } : { departmentId: task.department.id, planItem: task.item, date: task.date });
                    }}
                  />
                  <T style={{ color: C.purple, fontSize: 10, fontWeight: '700' }}>{'⁦+' + task.xp + ' XP⁩'}</T>
                </View>
              </View>
            );
          })
        ) : (
          <Empty text={ws.plan.length ? 'ما فيه مهام مجدولة في هذا اليوم.' : 'أضف الخطة الأسبوعية من الإعدادات لتظهر مهام كل يوم هنا.'} />
        )}
      </Card>

      <SectionTitle title="الشفت الحالي" sub={'بتوقيت السعودية · ' + now.time} />
      {ws.departments.map((department) => {
        const slot = currentSlot(ws, department, now);
        const open = openDept === department.id;
        return (
          <Card key={department.id} style={{ paddingVertical: 10 }}>
            <Pressable accessibilityRole="button" testID={'today-dept-' + department.id} onPress={() => setOpenDept(open ? null : department.id)}>
              <Spread>
                <Row style={{ flex: 1 }}>
                  <IconBox name="users" size={32} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '800' }}>{department.name}</T>
                    <Sub>{slot ? shiftLabel(slot) + ' · ' + periodRange(slot.period) : 'لا يوجد شفت نشط الآن'}</Sub>
                  </View>
                </Row>
                <Row gap={6}>
                  {slot ? <Chip tone="neutral" label={slot.crew.length + ' فني'} /> : null}
                  {slot?.dayAssigned ? <Chip tone="amber" label="تكليف يومي" /> : null}
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} color={C.muted} size={16} />
                </Row>
              </Spread>
            </Pressable>
            {open ? (
              <View style={{ marginTop: 8 }}>
                {slot?.crew.length ? (
                  slot.crew.map((tech) => (
                    <TechRow
                      key={tech.id}
                      ws={ws}
                      tech={tech}
                      asOf={now.date}
                      badge={tech.baseShiftId !== slot.shift?.id ? <Chip tone="amber" label="مكلف اليوم" /> : null}
                      right={<Button small variant="secondary" label="نقل/تكليف" testID={'tech-shift-' + tech.id} onPress={() => ui.openTechnician(tech.id, slot.date)} />}
                    />
                  ))
                ) : (
                  <Sub>ما فيه فنيون على رأس العمل في هذا القسم الآن.</Sub>
                )}
                <Button style={{ marginTop: 8 }} small variant="ghost" icon="calendar" label="فتح جدول الشفتات" onPress={() => ui.go('roster', { date: slot?.date ?? now.date })} />
              </View>
            ) : null}
          </Card>
        );
      })}

      <SectionTitle title="تقدمك مع جميع الفنيين" sub="هدف كل فني زيارتان خلال آخر 6 أشهر وحضور كل اجتماعات السنة" />
      <Card>
        <ProgressLine label="أكملوا الزيارات" value={overall.visitComplete} max={overall.people} />
        <ProgressLine label="أكملوا الاجتماعات" value={overall.meetingComplete} max={overall.people} color="#278969" />
        <ProgressLine label="أكملوا الاثنين" value={overall.complete} max={overall.people} color="#b07800" />
        <T style={{ fontWeight: '800', marginTop: 10 }}>أولوية المتابعة</T>
        {followUps.length ? (
          followUps.slice(0, 5).map((item) => (
            <Spread key={item.technician.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 7, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 13 }}>{item.technician.name}</T>
                <Sub>{item.departmentName + ' · ' + item.shiftName}</Sub>
              </View>
              <View style={{ gap: 3, alignItems: 'flex-end' }}>
                <Chip tone={tone(ws.settings.visitTarget - item.visitRemaining, ws.settings.visitTarget)} label={'زيارات متبقية ' + item.visitRemaining} />
                <Chip tone={tone(item.meetingTarget - item.meetingRemaining, item.meetingTarget)} label={'اجتماعات متبقية ' + item.meetingRemaining} />
              </View>
            </Spread>
          ))
        ) : (
          <Sub>{overall.people ? 'اكتملت تغطية جميع الفنيين 👏' : 'أضف الفنيين من الإعدادات.'}</Sub>
        )}
        {followUps.length > 5 ? <Button small variant="secondary" label={'عرض الكل · ' + followUps.length + ' فني'} onPress={() => ui.go('reports')} style={{ marginTop: 6 }} /> : null}
      </Card>

      <Card style={{ backgroundColor: '#fcfbff' }}>
        <T style={{ fontWeight: '800' }}>أولوية الزيارة الآن</T>
        <Sub>فنيون على رأس العمل بدون زيارة آخر {ws.settings.visitWindowMonths} أشهر</Sub>
        {priority.length ? (
          priority.map(({ tech, department }) => (
            <Row key={tech.id} style={{ marginTop: 8 }}>
              <Icon name="map-pin" size={14} />
              <T style={{ fontSize: 13 }}>
                <T style={{ fontWeight: '700', fontSize: 13 }}>{tech.name}</T>
                {' · ' + department.name}
              </T>
            </Row>
          ))
        ) : (
          <Row style={{ marginTop: 8 }}>
            <Icon name="check" size={14} color={C.green} />
            <Sub>ما فيه فنيون في الشفت الحالي بدون زيارة</Sub>
          </Row>
        )}
      </Card>
    </View>
  );
}

function Stat({ icon, label, value, tone: color }: { icon: React.ComponentProps<typeof IconBox>['name']; label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 9, gap: 4 }}>
      <Row gap={5}>
        <Icon name={icon} size={13} color={color === 'green' ? C.green : C.purple} />
        <Sub style={{ fontSize: 10 }}>{label}</Sub>
      </Row>
      <T style={{ fontSize: 17, fontWeight: '800' }}>{value}</T>
    </View>
  );
}

function ProgressLine({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Spread>
        <T style={{ fontSize: 13 }}>{label}</T>
        <T style={{ fontWeight: '800' }}>{ratio(value, max)}</T>
      </Spread>
      <Progress value={value} max={max} color={color} />
    </View>
  );
}
