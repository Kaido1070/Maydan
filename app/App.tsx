import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FollowScreen, OvertimeSheet } from './src/screens/FollowScreen';
import { MeetingsScreen } from './src/screens/MeetingsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { RosterScreen } from './src/screens/RosterScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ChangelogSheet, WhatsNewSheet } from './src/sheets/ChangelogSheet';
import { PersonSheet } from './src/sheets/PersonSheet';
import { SlotSheet, SlotTarget, TechnicianShiftSheet } from './src/sheets/ShiftSheets';
import { VisitSheet, VisitTarget } from './src/sheets/VisitSheet';
import { StoreProvider, useStore } from './src/store';
import { AppText as Text, C, Icon, IconName } from './src/ui/kit';
import { alpha, BLUR_LEVELS, themed } from './src/ui/theme';
import { useAppFonts } from './src/ui/fonts';
import { SettingsSection, Tab, Ui, UiContext } from './src/ui/ui';
import { APP_VERSION, Release, releasesSince } from './src/version';
import { dailyTasks } from './src/domain/daily';
import { weekProgress, xpSummary } from './src/domain/stats';
import { haptic, Touch } from './src/ui/touch';

/** iOS 26 وأحدث: زجاج النظام السائل. قبله: ضبابية النظام. */
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** آخر إصدار شاف المستخدم نافذة «الجديد» حقه. */
export const SEEN_VERSION_KEY = 'maydan-seen-version';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'day', label: 'اليوم', icon: 'grid' },
  { id: 'visits', label: 'الزيارات', icon: 'map-pin' },
  { id: 'meetings', label: 'الاجتماعات', icon: 'users' },
  { id: 'follow', label: 'المتابعة', icon: 'flag' },
  { id: 'reports', label: 'التقارير', icon: 'bar-chart-2' },
];

const TITLES: Record<Tab, string> = {
  day: 'مهام اليوم',
  visits: 'الزيارات',
  meetings: 'الاجتماعات',
  follow: 'المتابعة',
  reports: 'الإحصائيات والتقارير',
  roster: 'جدول الشفتات',
  settings: 'الإعدادات',
};

function Shell() {
  const insets = useSafeAreaInsets();
  const { mode, ready, ws, now, prefs } = useStore();
  const [tab, setTab] = useState<Tab>('day');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(null);
  const [rosterDate, setRosterDate] = useState<string | null>(null);
  const [focusMeetingId, setFocusMeetingId] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitTarget>(null);
  const [technician, setTechnician] = useState<{ id: string; date?: string } | null>(null);
  const [slot, setSlot] = useState<SlotTarget>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [whatsNew, setWhatsNew] = useState<Release[]>([]);
  const [changelog, setChangelog] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [overtime, setOvertime] = useState<{ id: string | null } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_VERSION_KEY)
      .then((seen) => setWhatsNew(releasesSince(seen)))
      .catch(() => {});
  }, []);
  const closeWhatsNew = () => {
    setWhatsNew([]);
    AsyncStorage.setItem(SEEN_VERSION_KEY, APP_VERSION).catch(() => {});
  };

  const ui = useMemo<Ui>(
    () => ({
      tab,
      go: (next, options) => {
        if (options?.departmentId) setDepartmentId(options.departmentId);
        if (options?.date) setRosterDate(options.date);
        setFocusMeetingId(options?.meetingId ?? null);
        setSettingsSection(next === 'settings' ? options?.section ?? null : null);
        setTab(next);
        scroll.current?.scrollTo({ y: 0, animated: false });
      },
      notify: (message) => {
        clearTimeout(toastTimer.current);
        setToast(message);
        if (celebrate(message)) haptic.success();
        toastTimer.current = setTimeout(() => setToast(null), 3000);
      },
      celebrateMilestone: (message) => {
        // يُضاف تحت رسالة الحفظ الحالية بدل ما يمسحها.
        clearTimeout(toastTimer.current);
        setToast((current) => (current ? current + '\n' + message : message));
        haptic.success();
        toastTimer.current = setTimeout(() => setToast(null), 4000);
      },
      openVisit: setVisit,
      openTechnician: (id, date) => setTechnician({ id, date }),
      openSlot: setSlot,
      openChangelog: () => setChangelog(true),
      openPerson: setPerson,
      openOvertime: (id) => setOvertime({ id }),
      focusMeetingId,
      settingsSection,
      departmentId,
      setDepartmentId,
      rosterDate,
      setRosterDate,
    }),
    [tab, departmentId, rosterDate, focusMeetingId, settingsSection],
  );

  // احتفالات الإنجاز: مستوى جديد، هدف الأسبوع، وكل مهام اليوم.
  const level = xpSummary(ws).level;
  const week = weekProgress(ws, now.date);
  const daily = useMemo(() => dailyTasks(ws, now), [ws, now]);
  const allDone = daily.length > 0 && daily.every((task) => task.done);
  const milestones = useRef<{ level: number; week: boolean; allDone: boolean } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const prev = milestones.current;
    const weekDone = week.visits >= week.goal;
    milestones.current = { level, week: weekDone, allDone };
    if (!prev) return;
    if (level > prev.level) ui.celebrateMilestone('⭐ وصلت المستوى ' + level + '! استمر');
    else if (allDone && !prev.allDone) ui.celebrateMilestone('🏆 خلّصت كل مهام اليوم! يوم ممتاز');
    else if (weekDone && !prev.week) ui.celebrateMilestone('🏅 حققت هدف الأسبوع: ' + week.goal + ' زيارات');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, level, allDone, week.visits, week.goal]);

  const Screen = { day: TodayScreen, visits: VisitsScreen, meetings: MeetingsScreen, follow: FollowScreen, reports: ReportsScreen, roster: RosterScreen, settings: SettingsScreen }[tab];

  return (
    <UiContext.Provider value={ui}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Touch
            testID="brand-home"
            accessibilityRole="button"
            accessibilityLabel="ميدان، الرجوع لمهام اليوم"
            onPress={() => ui.go('day')}
            style={({ pressed }) => [styles.brand, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.brandMark}>
              <Icon name="shield" size={22} color="#fff" />
              <View style={styles.brandCheck}>
                <Icon name="check" size={10} color="#eb6834" />
              </View>
            </View>
            <View>
              <Text style={styles.brandName}>ميدان</Text>
              <Text style={styles.brandSub}>{TITLES[tab]}</Text>
            </View>
          </Touch>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={mode === 'demo' ? 'وضع التجربة مفعّل. افتح الإعدادات للتبديل' : 'وضع العمل'}
              onPress={() => ui.go('settings')}
              style={[styles.modeBadge, mode === 'demo' ? styles.demo : styles.live]}
              testID="mode-badge"
            >
              <View style={[styles.dot, { backgroundColor: mode === 'demo' ? '#ffd27a' : '#7ce0b0' }]} />
              <Text style={styles.modeText}>{mode === 'demo' ? 'وضع التجربة' : 'بيانات العمل'}</Text>
            </Touch>
            <Touch accessibilityRole="button" accessibilityLabel="الإعدادات" onPress={() => ui.go('settings')} style={styles.gear} testID="open-settings">
              <Icon name="settings" size={18} color="#ddd8ec" />
            </Touch>
          </View>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: prefs.glass ? 30 + 72 + Math.max(insets.bottom, 8) : 30 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {ready ? <Screen /> : null}
        </ScrollView>

        <TabBar glassBottom={Math.max(insets.bottom, 8)}>
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <Touch
                key={item.id}
                testID={'tab-' + item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={() => ui.go(item.id)}
                feedback="select"
                scaleTo={0.92}
                style={styles.tab}
              >
                <View style={[styles.tabIcon, active && { backgroundColor: C.soft }]}>
                  <Icon name={item.icon} size={20} color={active ? C.link : C.muted} />
                </View>
                <Text style={[styles.tabText, active && { color: C.link, fontWeight: '800' }]}>{item.label}</Text>
              </Touch>
            );
          })}
        </TabBar>

        {toast ? (
          celebrate(toast) ? (
            <View pointerEvents="none" style={[styles.celebrate, { bottom: Math.max(insets.bottom, 8) + 80 }]} accessibilityLiveRegion="polite" testID="celebration">
              <Text style={{ fontSize: 34, lineHeight: 42 }}>{celebrationEmoji(toast)}</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{toast.replace(/^[🎉⭐🏅🏆]\s*/u, '')}</Text>
            </View>
          ) : (
          <View pointerEvents="none" style={[styles.toast, { bottom: Math.max(insets.bottom, 8) + 74 }]} accessibilityLiveRegion="polite">
            <Text style={{ color: '#fff', fontSize: 13 }}>{toast}</Text>
          </View>
          )
        ) : null}

        <VisitSheet
          target={visit}
          onClose={() => setVisit(null)}
          onSaved={(message) => {
            setVisit(null);
            ui.notify(message);
          }}
        />
        <TechnicianShiftSheet
          technicianId={technician?.id ?? null}
          initialDate={technician?.date}
          onClose={() => setTechnician(null)}
          onSaved={(message) => ui.notify(message)}
        />
        <WhatsNewSheet
          releases={whatsNew}
          onClose={closeWhatsNew}
          onShowAll={() => {
            closeWhatsNew();
            setChangelog(true);
          }}
        />
        <ChangelogSheet visible={changelog} onClose={() => setChangelog(false)} />
        <PersonSheet technicianId={person} onClose={() => setPerson(null)} />
        <OvertimeSheet visible={!!overtime} entryId={overtime?.id ?? null} onClose={() => setOvertime(null)} />
        <SlotSheet
          target={slot}
          onClose={() => setSlot(null)}
          onSaved={(message) => {
            setSlot(null);
            ui.notify(message);
          }}
        />
      </View>
    </UiContext.Provider>
  );
}

/** الشريط السفلي: زجاجي عائم (بدرجة ضبابية من الإعدادات) أو عادي ثابت. */
function TabBar({ children, glassBottom }: { children: React.ReactNode; glassBottom: number }) {
  const { prefs, theme } = useStore();
  if (!prefs.glass) {
    return (
      <View style={[styles.tabbar, { paddingBottom: glassBottom }]} accessibilityRole="tablist">
        {children}
      </View>
    );
  }
  const level = BLUR_LEVELS[prefs.blur] ?? BLUR_LEVELS[2];
  const frame = [styles.tabbarGlass, { bottom: glassBottom, borderColor: alpha(theme === 'dark' ? '#ffffff' : '#ffffff', theme === 'dark' ? 0.14 : 0.7) }];
  const tint = { ...fill, backgroundColor: alpha(C.white, level.tint) };
  if (LIQUID) {
    return (
      <GlassView testID="tabbar-glass" glassEffectStyle={prefs.blur < 2 ? 'clear' : 'regular'} colorScheme={theme} isInteractive style={frame} accessibilityRole="tablist">
        <View pointerEvents="none" style={{ ...fill, backgroundColor: alpha(C.white, level.tint * 0.5) }} />
        {children}
      </GlassView>
    );
  }
  return (
    <View testID="tabbar-glass" style={[frame, styles.tabbarShadow]} accessibilityRole="tablist">
      <BlurView pointerEvents="none" intensity={level.intensity} tint={theme === 'dark' ? 'dark' : 'light'} style={fill} />
      <View pointerEvents="none" style={tint} />
      {children}
    </View>
  );
}
const fill = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 30 } as const;

/** رسائل الإنجاز تطلع كاحتفال كبير. */
const celebrate = (message: string) => /XP|^[🎉⭐🏅🏆]/u.test(message);
const celebrationEmoji = (message: string) => message.match(/^[🎉⭐🏅🏆]/u)?.[0] ?? '🎉';

export default function App() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: C.night }} />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.night },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#6142d1', alignItems: 'center', justifyContent: 'center' },
  brandCheck: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 1 },
  brandName: { color: '#fff', fontSize: 19, fontWeight: '800' },
  brandSub: { color: '#cfc9e0', fontSize: 12 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  demo: { backgroundColor: '#3a2d18', borderColor: C.amber },
  live: { backgroundColor: '#163528', borderColor: '#24614a' },
  modeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  gear: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#2a2440', alignItems: 'center', justifyContent: 'center' },
  tabbarGlass: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', borderRadius: 30, paddingVertical: 7, paddingHorizontal: 4, overflow: 'hidden', borderWidth: 1 },
  tabbarShadow: { shadowColor: '#1a1040', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  tabbar: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 50 },
  tabIcon: { width: 48, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, color: C.muted },
  celebrate: { position: 'absolute', alignSelf: 'center', backgroundColor: C.hero, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 14, alignItems: 'center', maxWidth: '88%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#251a42', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '90%' },
}) as const);
