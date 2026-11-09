import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DailyTask, dailyTasks, taskReason } from '../domain/daily';
import { formatDate } from '../domain/dates';
import { currentSlot, periodRange, shiftLabel } from '../domain/shifts';
import { dayProgress, visitStreak, weekProgress, xpSummary } from '../domain/stats';
import { isWorkTime, scheduleOf } from '../domain/worktime';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Icon, IconBox, KIND, Progress, Row, SectionTitle, Spread, Sub, T } from '../ui/kit';
import { TechRow } from '../ui/TechRow';
import { useUi } from '../ui/ui';
import { VisitPlanCard } from '../ui/VisitPlanCard';
import { Touch } from '../ui/touch';

const PAGE = 8;

type Kind = 'visit' | 'meeting';

export function TodayScreen() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const xp = xpSummary(ws);
  const today = dayProgress(ws, now.date);
  const streak = visitStreak(ws, now.date);
  const week = weekProgress(ws, now.date);
  const schedule = scheduleOf(ws.settings);
  const outside = !isWorkTime(ws.settings, now.date, now.time);
  const all = dailyTasks(ws, now);
  const open = all.filter((task) => !task.done);
  const doneAll = all.filter((task) => task.done);
  const name = ws.settings.engineerName.trim();
  const hour = Number(now.time.slice(0, 2));
  const greeting = (hour < 12 ? 'صباح الخير' : 'مساء الخير') + (name ? ' يا ' + name : '');
  const left = Math.max(0, today.goal - today.visits);
  const goalMet = today.workDay && today.visits >= today.goal;
  const message = !today.workDay
    ? 'يوم إجازة 🌴 استرح، أهدافك ترجع يوم الدوام'
    : !ws.technicians.length
      ? 'أدخل بياناتك وابدأ أول زيارة.'
      : goalMet
        ? 'حققت هدف اليوم 🎉 عمل ممتاز!'
        : left === 1
          ? 'باقي زيارة وحدة وتحقق هدف اليوم 💪'
          : today.visits
            ? 'باقي ' + left + ' زيارات وتحقق هدف اليوم'
            : 'ابدأ بأول زيارة من خطة اليوم 👇';
  const year = Number(now.date.slice(0, 4));
  const setup = [
    { section: 'people' as const, icon: 'users' as const, title: 'الموظفون والفرق', hint: 'استورد ملف Excel أو أضفهم يدويًا', count: ws.technicians.length },
    { section: 'places' as const, icon: 'package' as const, title: 'المستودعات ونقاط الانطلاق', hint: 'اكتب أسماءها', count: (ws.places ?? []).length },
    { section: 'meetings' as const, icon: 'message-square' as const, title: 'عناوين الاجتماعات', hint: 'اكتب عناوين اجتماعات السنة', count: ws.meetings.filter((m) => m.year === year).length },
  ];
  const setupLeft = setup.filter((step) => !step.count).length;

  return (
    <View>
      <View style={styles.hero}>
        <Spread style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T style={{ color: '#d9ccff', fontSize: 13 }}>{greeting}</T>
            <T style={{ color: '#fff', fontSize: 13, opacity: 0.8 }}>{formatDate(now.date, { weekday: true })}</T>
          </View>
          <View testID="hero-streak" style={styles.badge}>
            <T style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{'🔥 ' + (streak.days ? streak.days + (streak.days === 1 ? ' يوم' : ' أيام') : 'ابدأ السلسلة')}</T>
          </View>
        </Spread>
        <Spread style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <View>
            <T testID="hero-progress" style={{ color: '#fff', fontSize: 40, fontWeight: '700', lineHeight: 50 }}>
              {today.workDay ? '⁦' + today.visits + ' / ' + today.goal + '⁩' : String(today.visits)}
            </T>
            <T style={{ color: '#e9e1ff', fontSize: 14 }}>{today.workDay ? 'زيارات اليوم' : 'زيارات في يوم إجازة'}</T>
          </View>
          <T style={{ fontSize: 40, lineHeight: 50 }}>{goalMet ? '🏆' : today.workDay ? '' : '🌴'}</T>
        </Spread>
        <Progress value={today.visits} max={Math.max(today.goal, 1)} color="#7ce0b0" track="#ffffff2e" height={10} />
        <T style={{ color: '#fff', fontSize: 14, marginTop: 2 }}>{message}</T>
        <View testID="hero-week" style={styles.week}>
          <Spread>
            <T style={{ color: '#fff', fontSize: 13 }}>{week.visits >= week.goal ? '🏅 حققت هدف الأسبوع' : 'هدف الأسبوع'}</T>
            <T style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{'⁦' + week.visits + ' / ' + week.goal + '⁩ زيارة'}</T>
          </Spread>
          <Progress value={week.visits} max={week.goal} color="#ffd27a" track="#ffffff2e" height={8} />
          <T style={{ color: '#d9ccff', fontSize: 12 }}>{'⭐ مستوى ' + xp.level + ' · ⁦' + xp.levelXp + '/100 XP⁩'}</T>
        </View>
      </View>

      {outside ? (
        <View testID="outside-hours" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7e6', borderRadius: 16, borderWidth: 1, borderColor: '#f5dca3', padding: 12, marginTop: 12 }}>
          <T style={{ fontSize: 24, lineHeight: 30 }}>🌙</T>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>أنت خارج الدوام الحين</T>
            <Sub>{'دوامك ' + (schedule.days.length === 5 && schedule.days.join() === '0,1,2,3,4' ? 'الأحد–الخميس' : schedule.days.length + ' أيام') + ' ⁦' + schedule.start + '–' + schedule.end + '⁩. إذا تشتغل الحين سجّله.'}</Sub>
          </View>
          <Button testID="log-overtime" small label="سجّل" icon="clock" onPress={() => ui.openOvertime(null)} />
        </View>
      ) : null}

      {setupLeft ? (
        <View testID="setup-card" style={styles.setup}>
          <T style={{ fontWeight: '700', fontSize: 17 }}>{ws.technicians.length ? 'كمّل بياناتك' : 'ابدأ من هنا'}</T>
          <Sub>{'أدخل بياناتك مرة وحدة، والتطبيق يطلع لك الخطة والتذكيرات والتقارير. باقي ' + setupLeft + ' من 3.'}</Sub>
          {setup.map((step, index) => (
            <Touch
              key={step.section}
              testID={'setup-' + step.section}
              accessibilityRole="button"
              accessibilityLabel={step.title}
              feedback="select"
              scaleTo={0.98}
              onPress={() => ui.go('settings', { section: step.section })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: index ? 0 : 10 }}
            >
              <IconBox name={step.count ? 'check' : step.icon} tone={step.count ? 'green' : 'purple'} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '700' }}>{step.title}</T>
                <Sub>{step.count ? 'تم · ' + step.count : step.hint}</Sub>
              </View>
              <Icon name="chevron-left" size={16} color={C.muted} />
            </Touch>
          ))}
        </View>
      ) : null}

      {ws.technicians.length ? <VisitPlanCard /> : null}

      {open.length ? (
        <>
          <SectionTitle title="تذكيرات" sub="ناس يداومون اليوم وما وصلتهم للحين" />
          <Card style={{ paddingVertical: 2 }}>
            {(['visit', 'meeting'] as Kind[]).map((kind, index) => {
              const list = open.filter((task) => task.kind === kind);
              if (!list.length) return null;
              const expanded = openKind === kind;
              return (
                <View key={kind} style={{ borderTopWidth: index && open.some((t) => t.kind === 'visit') ? 1 : 0, borderTopColor: C.line }}>
                  <Touch
                    testID={'reminders-' + kind}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    feedback="select"
                    scaleTo={0.98}
                    onPress={() => {
                      setOpenKind(expanded ? null : kind);
                      setLimit(PAGE);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
                  >
                    <View style={{ minWidth: 46, height: 46, borderRadius: 14, paddingHorizontal: 8, backgroundColor: KIND[kind].bg, alignItems: 'center', justifyContent: 'center' }}>
                      <T style={{ color: KIND[kind].fg, fontWeight: '700', fontSize: 19 }}>{list.length}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '700' }}>{kind === 'visit' ? 'ما نزلت عليهم زيارة' : 'ما حضروا أي اجتماع'}</T>
                      <Sub>{kind === 'visit' ? 'خلال آخر ' + ws.settings.visitWindowMonths + ' أشهر' : 'هالسنة'}</Sub>
                    </View>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
                  </Touch>
                  {expanded ? (
                    <View style={{ paddingBottom: 6 }}>
                      {list.slice(0, limit).map((task) => (
                        <TaskRow key={task.kind + task.technician.id} task={task} first={false} />
                      ))}
                      {list.length > limit ? <Button small variant="ghost" label={'عرض المزيد · ' + (list.length - limit)} onPress={() => setLimit(limit + PAGE * 2)} /> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
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
        title="من يداوم الحين"
        sub={'بتوقيت السعودية · ' + now.time}
        right={<Button small variant="secondary" icon="calendar" label="جدول الشفتات" testID="open-roster" onPress={() => ui.go('roster', { date: now.date })} />}
      />
      <Card style={{ paddingVertical: 2 }}>
        {ws.departments.map((department, index) => {
          const slot = currentSlot(ws, department, now);
          const expanded = openDept === department.id;
          return (
            <View key={department.id} style={{ borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <Touch accessibilityRole="button" testID={'today-dept-' + department.id} feedback="select" scaleTo={0.98} onPress={() => setOpenDept(expanded ? null : department.id)} style={{ paddingVertical: 11 }}>
                <Spread>
                  <Row style={{ flex: 1 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: slot?.crew.length ? '#2fbf71' : '#c9c4d6' }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={{ fontWeight: '700' }}>{department.name}</T>
                      <Sub numberOfLines={1}>{slot ? shiftLabel(slot) + ' · ' + periodRange(slot.period) : 'لا يوجد شفت الآن'}</Sub>
                    </View>
                  </Row>
                  <Row gap={6}>
                    {slot?.dayAssigned ? <Chip tone="amber" label="تكليف يومي" /> : null}
                    {slot ? <Chip tone="neutral" label={String(slot.crew.length)} icon="users" /> : null}
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={C.muted} size={16} />
                  </Row>
                </Spread>
              </Touch>
              {expanded ? (
                <View style={{ paddingBottom: 10 }}>
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
                    <Sub>ما فيه أحد على رأس العمل في هذا القسم الآن.</Sub>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
        {!ws.departments.length ? <Empty text="أضف الأقسام من الإعدادات." /> : null}
      </Card>
    </View>
  );
}

function TaskRow({ task, first }: { task: DailyTask; first: boolean }) {
  const { ws } = useStore();
  const ui = useUi();
  const visit = task.kind === 'visit';
  return (
    <Touch
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
    </Touch>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#4a2f9a', borderRadius: 22, padding: 16 },
  badge: { backgroundColor: '#ffffff24', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12 },
  week: { marginTop: 14, backgroundColor: '#ffffff14', borderRadius: 14, padding: 10 },
  setup: { backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: '#cdbbf6', padding: 14, marginTop: 12 },
});
