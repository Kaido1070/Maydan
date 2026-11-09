import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DailyTask, dailyTasks, taskReason } from '../domain/daily';
import { activeTechnicians, currentSlot, periodRange, shiftLabel } from '../domain/shifts';
import { coverageOf, dayProgress, followUpList, tone, xpSummary } from '../domain/stats';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Icon, IconBox, Progress, ratio, Row, SectionTitle, Segmented, Spread, Sub, T } from '../ui/kit';
import { TechRow } from '../ui/TechRow';
import { useUi } from '../ui/ui';

type Filter = 'all' | 'visit' | 'meeting';
const PAGE = 8;

export function TodayScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const xp = xpSummary(ws);
  const today = dayProgress(ws, now.date);
  const all = dailyTasks(ws, now);
  const tasks = all.filter((task) => filter === 'all' || task.kind === filter);
  const pending = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);
  const open = all.filter((task) => !task.done);
  const visitsOpen = open.filter((task) => task.kind === 'visit').length;
  const meetingsOpen = open.filter((task) => task.kind === 'meeting').length;
  const name = ws.settings.engineerName.trim();
  const overall = coverageOf(ws, activeTechnicians(ws), now.date).coverage;
  const followUps = followUpList(ws, now.date);

  const heroText =
    today.visits >= today.goal
      ? 'أكملت هدف الزيارات اليوم. تقدر تكمل الاجتماعات أو تراجع الفنيين الباقين.'
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
          <T style={{ color: '#e3d7ff', fontSize: 10 }}>{'\u2066' + xp.levelXp + ' / 100 XP\u2069'}</T>
        </View>
      </View>

      <Row style={{ marginTop: 10 }} gap={8}>
        <Stat icon="map-pin" label="زيارات اليوم" value={ratio(today.visits, today.goal)} tone={tone(today.visits, today.goal)} />
        <Stat icon="check" label="مهام منجزة" value={ratio(all.length - open.length, all.length)} />
        <Stat icon="zap" label="إجمالي الخبرة" value={'\u2066' + xp.xp + ' XP\u2069'} />
      </Row>

      <Card style={{ marginTop: 10 }}>
        <Row>
          <IconBox name="target" />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '800', fontSize: 15 }}>تحدي اليوم</T>
            <Sub>{today.visits >= today.goal ? 'حققت هدف الزيارات اليوم 🎉' : 'تابع إنجازك خطوة بخطوة'}</Sub>
          </View>
        </Row>
        <Spread style={{ marginTop: 10 }}>
          <T style={{ fontSize: 13 }}>زيارات ميدانية</T>
          <T style={{ fontWeight: '800' }}>{ratio(today.visits, today.goal)}</T>
        </Spread>
        <Progress value={today.visits} max={today.goal} />
        <Spread>
          <T style={{ fontSize: 13 }}>حضور اجتماعات اليوم</T>
          <T style={{ fontWeight: '800' }}>{today.meetings}</T>
        </Spread>
      </Card>

      <SectionTitle
        title="مهام اليوم"
        sub={open.length ? 'تذكير بالفنيين اللي يداومون اليوم وباقي عليهم زيارة أو اجتماع. اضغط على أي فني لتفاصيله.' : 'ما فيه مهام باقية اليوم.'}
      />
      <View style={{ marginBottom: 10 }}>
        <Segmented
          options={[
            { value: 'all', label: 'الكل · ' + open.length },
            { value: 'visit', label: 'زيارات · ' + visitsOpen },
            { value: 'meeting', label: 'اجتماعات · ' + meetingsOpen },
          ]}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setLimit(PAGE);
          }}
        />
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {pending.length ? (
          pending.slice(0, limit).map((task, index) => <TaskRow key={task.kind + task.technician.id} task={task} first={!index} />)
        ) : (
          <Empty
            text={
              !ws.technicians.length
                ? 'أضف الفنيين من الإعدادات لتظهر مهام اليوم.'
                : done.length
                  ? 'خلّصت كل مهام اليوم 👏'
                  : 'ما فيه أحد يداوم اليوم باقي عليه زيارة أو اجتماع 👏'
            }
          />
        )}
        {pending.length > limit ? <Button small variant="ghost" label={'عرض المزيد · ' + (pending.length - limit)} onPress={() => setLimit(limit + PAGE * 2)} /> : null}
      </Card>
      {done.length ? (
        <Card style={{ paddingVertical: 4 }}>
          <Sub style={{ fontWeight: '700', paddingTop: 8 }}>{'منجز اليوم · ' + done.length}</Sub>
          {done.map((task, index) => (
            <TaskRow key={task.kind + task.technician.id} task={task} first={!index} />
          ))}
        </Card>
      ) : null}

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

    </View>
  );
}

function TaskRow({ task, first }: { task: DailyTask; first: boolean }) {
  const { ws } = useStore();
  const ui = useUi();
  const visit = task.kind === 'visit';
  return (
    <Pressable
      testID={'daily-' + task.kind + '-' + task.technician.id}
      accessibilityRole="button"
      accessibilityLabel={(visit ? 'زيارة ' : 'اجتماع ') + task.technician.name}
      onPress={() => ui.openPerson(task.technician.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        paddingVertical: 11,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: C.line,
        opacity: pressed ? 0.6 : task.done ? 0.6 : 1,
      })}
    >
      <IconBox name={task.done ? 'check' : visit ? 'map-pin' : 'users'} tone={task.done ? 'green' : visit ? 'purple' : 'amber'} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip tone={task.done ? 'green' : visit ? 'purple' : 'amber'} label={visit ? 'زيارة' : 'اجتماع'} />
          <T style={{ fontWeight: '700' }}>{task.technician.name}</T>
        </Row>
        <Sub>{taskReason(task, ws.settings) + ' · ' + task.department.name + (task.onShiftNow ? ' · على رأس العمل' : '')}</Sub>
      </View>
      <Icon name="chevron-left" size={16} color={C.muted} />
    </Pressable>
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
