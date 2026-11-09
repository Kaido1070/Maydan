import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DailyTask, dailyTasks, taskReason } from '../domain/daily';
import { formatDate } from '../domain/dates';
import { currentSlot, periodRange, shiftLabel } from '../domain/shifts';
import { dayProgress, visitStreak, xpSummary } from '../domain/stats';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Icon, IconBox, KIND, Progress, Row, SectionTitle, Segmented, Spread, Sub, T } from '../ui/kit';
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
  const streak = visitStreak(ws, now.date);
  const all = dailyTasks(ws, now);
  const open = all.filter((task) => !task.done);
  const doneAll = all.filter((task) => task.done);
  const next = open[0];
  const rest = open.slice(1).filter((task) => filter === 'all' || task.kind === filter);
  const name = ws.settings.engineerName.trim();
  const hour = Number(now.time.slice(0, 2));
  const greeting = (hour < 12 ? 'صباح الخير' : 'مساء الخير') + (name ? ' يا ' + name : '');
  const message = !all.length
    ? ws.technicians.length
      ? 'ما فيه أحد يداوم اليوم باقي عليه زيارة أو اجتماع.'
      : 'أضف الفنيين من الإعدادات لتبدأ.'
    : !open.length
      ? 'خلّصت كل مهام اليوم 🎉 عمل ممتاز!'
      : open.length === 1
        ? 'باقي مهمة وحدة وتخلّص يومك 💪'
        : 'باقي ' + open.length + ' مهام. كل مهمة \u2066+' + ws.settings.xpVisit + ' XP\u2069';

  const recordNext = () => {
    if (!next) return;
    if (next.kind === 'visit') ui.openVisit({ departmentId: next.technician.departmentId, technicianIds: [next.technician.id] });
    else ui.go('meetings', { departmentId: next.technician.departmentId, meetingId: next.progress.missingMeetings[0]?.id });
  };

  return (
    <View>
      <View style={styles.hero}>
        <T style={{ color: '#d9ccff', fontSize: 13 }}>{greeting}</T>
        <T style={{ color: '#fff', fontSize: 13, opacity: 0.8 }}>{formatDate(now.date, { weekday: true })}</T>
        <Spread style={{ marginTop: 10, alignItems: 'flex-end' }}>
          <View>
            <T testID="hero-progress" style={{ color: '#fff', fontSize: 34, fontWeight: '700', lineHeight: 44 }}>
              {'\u2066' + doneAll.length + ' / ' + all.length + '\u2069'}
            </T>
            <T style={{ color: '#e9e1ff', fontSize: 13 }}>مهام اليوم المنجزة</T>
          </View>
          {all.length && !open.length ? <T style={{ fontSize: 40, lineHeight: 50 }}>🏆</T> : null}
        </Spread>
        <Progress value={doneAll.length} max={Math.max(all.length, 1)} color="#7ce0b0" track="#ffffff2e" height={10} />
        <T style={{ color: '#fff', fontSize: 14, marginTop: 2 }}>{message}</T>
        <Row gap={8} style={{ marginTop: 12 }}>
          <HeroPill
            testID="hero-streak"
            emoji="🔥"
            value={streak.days ? streak.days + (streak.days === 1 ? ' يوم' : ' أيام') : 'ابدأ اليوم'}
            label={streak.days ? 'سلسلة الإنجاز' : 'حقق ' + today.goal + ' زيارات'}
          />
          <HeroPill emoji="📍" value={'\u2066' + today.visits + '/' + today.goal + '\u2069'} label="زيارات اليوم" />
          <HeroPill emoji="⭐" value={'مستوى ' + xp.level} label={'\u2066' + xp.levelXp + '/100 XP\u2069'} />
        </Row>
      </View>

      {next ? (
        <View testID="next-task" style={[styles.next, { borderColor: KIND[next.kind].solid }]}>
          <Row gap={6}>
            <Chip tone={next.kind} label={next.kind === 'visit' ? 'المهمة التالية · زيارة' : 'المهمة التالية · اجتماع'} />
            {next.onShiftNow ? <Chip tone="green" label="على رأس العمل" /> : null}
          </Row>
          <T style={{ fontSize: 20, fontWeight: '700', marginTop: 8 }}>{next.technician.name}</T>
          <Sub>{taskReason(next, ws.settings) + ' · ' + next.department.name}</Sub>
          <Row style={{ marginTop: 12 }}>
            <Button
              testID="next-record"
              style={{ flex: 1, backgroundColor: KIND[next.kind].solid }}
              icon={next.kind === 'visit' ? 'map-pin' : 'users'}
              label={next.kind === 'visit' ? 'سجّل الزيارة' : 'سجّل الحضور'}
              onPress={recordNext}
            />
            <Button variant="secondary" label="التفاصيل" onPress={() => ui.openPerson(next.technician.id)} />
          </Row>
        </View>
      ) : null}

      {open.length > 1 ? (
        <>
          <SectionTitle title="باقي المهام" />
          <View style={{ marginBottom: 10 }}>
            <Segmented
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'visit', label: 'زيارات · ' + open.filter((t) => t.kind === 'visit').length },
                { value: 'meeting', label: 'اجتماعات · ' + open.filter((t) => t.kind === 'meeting').length },
              ]}
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setLimit(PAGE);
              }}
            />
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {rest.length ? (
              rest.slice(0, limit).map((task, index) => <TaskRow key={task.kind + task.technician.id} task={task} first={!index} />)
            ) : (
              <Empty text="ما فيه مهام من هذا النوع." />
            )}
            {rest.length > limit ? <Button small variant="ghost" label={'عرض المزيد · ' + (rest.length - limit)} onPress={() => setLimit(limit + PAGE * 2)} /> : null}
          </Card>
        </>
      ) : null}

      {doneAll.length ? (
        <Card style={{ paddingVertical: 4, backgroundColor: '#f6fbf8', borderColor: '#d5efe0' }}>
          <Sub style={{ fontWeight: '700', paddingTop: 8, color: C.green }}>{'✓ منجز اليوم · ' + doneAll.length}</Sub>
          {doneAll.map((task, index) => (
            <TaskRow key={task.kind + task.technician.id} task={task} first={!index} />
          ))}
        </Card>
      ) : null}

      <SectionTitle
        title="الشفت الحالي"
        sub={'بتوقيت السعودية · ' + now.time}
        right={<Button small variant="secondary" icon="calendar" label="جدول الشفتات" testID="open-roster" onPress={() => ui.go('roster', { date: now.date })} />}
      />
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

      <Pressable accessibilityRole="button" onPress={() => ui.go('reports')} style={{ marginTop: 6 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBox name="bar-chart-2" size={34} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>تقدم التغطية لكل الفنيين</T>
            <Sub>الرسوم، والمتبقي لكل قسم وشفت، ومن باقي عليه</Sub>
          </View>
          <Icon name="chevron-left" size={16} color={C.muted} />
        </Card>
      </Pressable>

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
      <IconBox name={task.done ? 'check' : visit ? 'map-pin' : 'users'} tone={task.done ? 'green' : task.kind} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip tone={task.done ? 'green' : task.kind} label={visit ? 'زيارة' : 'اجتماع'} />
          <T style={{ fontWeight: '700' }}>{task.technician.name}</T>
        </Row>
        <Row gap={6}>
          {task.onShiftNow && !task.done ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#2fbf71' }} /> : null}
          <Sub>{task.done ? taskReason(task, ws.settings) : task.department.name + (task.onShiftNow ? ' · على رأس العمل' : '')}</Sub>
        </Row>
      </View>
      <Icon name="chevron-left" size={16} color={C.muted} />
    </Pressable>
  );
}

function HeroPill({ emoji, value, label, testID }: { emoji: string; value: string; label: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.pill}>
      <T style={{ fontSize: 18, lineHeight: 24 }}>{emoji}</T>
      <T style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{value}</T>
      <T style={{ color: '#d9ccff', fontSize: 11 }}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#4a2f9a', borderRadius: 22, padding: 16 },
  pill: { flex: 1, backgroundColor: '#ffffff1f', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  next: { backgroundColor: C.white, borderRadius: 18, borderWidth: 2, padding: 14, marginTop: 12 },
});
