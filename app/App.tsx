import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { BlurView } from 'expo-blur';
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
import { MeetingSheet, MeetingTarget } from './src/sheets/MeetingSheet';
import { StoreProvider, useStore } from './src/store';
import { DriveBackupProvider } from './src/drive/DriveBackup';
import { AppText as Text, C, Icon, IconName } from './src/ui/kit';
import { alpha, BLUR_LEVELS, SPACE, themed } from './src/ui/theme';
import { hasNativeTabBar, NativeTabBar } from './src/ui/NativeTabBar';
import { useAppFonts } from './src/ui/fonts';
import { SettingsSection, Tab, Ui, UiContext } from './src/ui/ui';
import { APP_VERSION, Release, releasesSince } from './src/version';
import { dailyTasks } from './src/domain/daily';
import { weekProgress, xpSummary } from './src/domain/stats';
import { haptic, Touch } from './src/ui/touch';

/** آخر إصدار شاف المستخدم نافذة «الجديد» حقه. */
export const SEEN_VERSION_KEY = 'maydan-seen-version';

const TABS = [
  { id: 'day', label: 'اليوم', icon: 'grid', symbol: 'square.grid.2x2' },
  { id: 'visits', label: 'الزيارات', icon: 'map-pin', symbol: 'mappin.circle' },
  { id: 'meetings', label: 'الاجتماعات', icon: 'users', symbol: 'person.2' },
  { id: 'follow', label: 'المتابعة', icon: 'flag', symbol: 'flag' },
  { id: 'reports', label: 'التقارير', icon: 'bar-chart-2', symbol: 'chart.bar' },
] as const satisfies readonly { id: Tab; label: string; icon: IconName; symbol: string }[];

type MainTab = typeof TABS[number]['id'];
const NATIVE_TABS = TABS.map(({ id, label, symbol }) => ({ id, title: label, symbol }));

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
  // الشريط السفلي العائم يختفي لما تنزل ويرجع لما تطلع (مثل شريط النظام في iOS 26).
  const [barShift] = useState(() => new Animated.Value(0));
  const barState = useRef({ y: 0, hidden: false });
  const setBarHidden = useCallback((hidden: boolean) => {
    if (barState.current.hidden === hidden) return;
    barState.current.hidden = hidden;
    Animated.timing(barShift, { toValue: hidden ? 1 : 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [barShift]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = contentOffset.y;
    const delta = y - barState.current.y;
    const atEnd = y + layoutMeasurement.height >= contentSize.height - 24;
    if (y < 40 || atEnd) setBarHidden(false);
    else if (delta > 6) setBarHidden(true);
    else if (delta < -6) setBarHidden(false);
    barState.current.y = y;
  };
  const { mode, ready, ws, now, prefs, theme } = useStore();
  const [tab, setTab] = useState<Tab>('day');
  const [mainTab, setMainTab] = useState<MainTab>('day');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(null);
  const [rosterDate, setRosterDate] = useState<string | null>(null);
  const [focusMeetingId, setFocusMeetingId] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitTarget>(null);
  const [meeting, setMeeting] = useState<MeetingTarget>(null);
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
        const primary = TABS.find((item) => item.id === next);
        if (primary) setMainTab(primary.id);
        setBarHidden(false);
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
      openMeeting: setMeeting,
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
    [tab, departmentId, rosterDate, focusMeetingId, settingsSection, setBarHidden],
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
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.header}>
          <Touch
            testID="brand-home"
            accessibilityRole="button"
            accessibilityLabel="ميدان، الرجوع لمهام اليوم"
            onPress={() => ui.go('day')}
            style={({ pressed }) => [styles.brand, pressed && { opacity: 0.7 }]}
          >
            <Image source={require('./assets/icon.png')} style={styles.brandMark} accessible={false} />
            <View style={styles.brandInfo}>
              <View style={styles.brandTitle}>
                <Text style={styles.brandName}>ميدان</Text>
                <Text testID="header-version" accessibilityLabel={'الإصدار ' + APP_VERSION} style={styles.brandVersion}>{APP_VERSION}</Text>
              </View>
              <Text numberOfLines={1} style={styles.brandSub}>{TITLES[tab]}</Text>
            </View>
          </Touch>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={mode === 'demo' ? 'وضع التجربة مفعّل. افتح الإعدادات للتبديل' : 'وضع العمل'}
              onPress={() => ui.go('settings')}
              hitSlop={{ top: 10, bottom: 10 }}
              style={[styles.modeBadge, mode === 'demo' ? styles.demo : styles.live]}
              testID="mode-badge"
            >
              <View style={[styles.dot, { backgroundColor: mode === 'demo' ? C.amber : C.green }]} />
              <Text style={[styles.modeText, { color: mode === 'demo' ? C.amber : C.green }]}>{mode === 'demo' ? 'وضع التجربة' : 'بيانات العمل'}</Text>
            </Touch>
            <Touch accessibilityRole="button" accessibilityLabel="الإعدادات" onPress={() => ui.go('settings')} hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }} feedback="select" style={styles.gear} testID="open-settings">
              <Icon name="settings" size={19} color={C.muted} />
            </Touch>
          </View>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: SPACE.screen, paddingTop: 6, paddingBottom: prefs.glass ? 30 + 72 + Math.max(insets.bottom, 8) : 30 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScroll={prefs.glass ? onScroll : undefined} scrollEventThrottle={16}>
          {ready ? <Screen /> : null}
        </ScrollView>

        <TabBar glassBottom={Math.max(insets.bottom, 8)} shift={barShift} selection={mainTab} onSelect={(id) => {
          haptic.select();
          ui.go(id);
        }}>
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
        <MeetingSheet
          target={meeting}
          onClose={() => setMeeting(null)}
          onSaved={(message) => {
            setMeeting(null);
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

/** Use the iOS tab bar directly; older systems retain the configurable blur. */
function TabBar({ children, glassBottom, shift, selection, onSelect }: {
  children: React.ReactNode;
  glassBottom: number;
  shift: Animated.Value;
  selection: MainTab;
  onSelect: (id: MainTab) => void;
}) {
  const { prefs, theme } = useStore();
  if (!prefs.glass) {
    return (
      <View style={[styles.tabbar, { paddingBottom: glassBottom }]} accessibilityRole="tablist">
        {children}
      </View>
    );
  }
  const transform = [{ translateY: shift.interpolate({ inputRange: [0, 1], outputRange: [0, 110 + glassBottom] }) }];
  if (hasNativeTabBar) {
    return (
      <Animated.View pointerEvents="box-none" testID="tabbar-wrap" style={[styles.nativeTabbarWrap, { height: 82 + glassBottom, transform }]}>
        <NativeTabBar
          testID="tabbar-glass"
          style={{ flex: 1 }}
          items={NATIVE_TABS}
          selection={selection}
          colorScheme={theme}
          selectionColor={C.link}
          onTabSelect={({ nativeEvent }) => {
            const selected = TABS.find((item) => item.id === nativeEvent.id);
            if (selected) onSelect(selected.id);
          }}
        />
      </Animated.View>
    );
  }
  const level = BLUR_LEVELS[prefs.blur] ?? BLUR_LEVELS[2];
  const borderColor = alpha('#ffffff', theme === 'dark' ? 0.14 : 0.7);
  const opacity = shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Animated.View testID="tabbar-wrap" style={[styles.tabbarWrap, { bottom: glassBottom, transform, opacity }]}>
      <View testID="tabbar-glass" style={[styles.tabbarGlass, styles.tabbarShadow, { borderColor }]} accessibilityRole="tablist">
        <BlurView pointerEvents="none" intensity={level.intensity} tint={theme === 'dark' ? 'dark' : 'light'} style={fill} />
        <View pointerEvents="none" style={{ ...fill, backgroundColor: alpha(C.white, level.tint) }} />
        {children}
      </View>
    </Animated.View>
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
        <DriveBackupProvider><Shell /></DriveBackupProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.screen, paddingTop: 8, paddingBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 10 },
  brandInfo: { flexShrink: 1 },
  brandTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandVersion: { color: C.link, fontSize: 12, fontWeight: '700', writingDirection: 'ltr' },
  brandMark: { width: 38, height: 38, borderRadius: 13 },
  brandName: { color: C.ink, fontSize: 20, fontWeight: '700' },
  brandSub: { color: C.muted, fontSize: 12.5 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, borderWidth: 1 },
  demo: { backgroundColor: C.amberBg, borderColor: C.amberLine },
  live: { backgroundColor: C.greenBg, borderColor: C.greenLine },
  modeText: { fontSize: 12.5, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  gear: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' },
  tabbarWrap: { position: 'absolute', left: 16, right: 16 },
  nativeTabbarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  tabbarGlass: { flexDirection: 'row', borderRadius: 30, paddingVertical: 7, paddingHorizontal: 4, overflow: 'hidden', borderWidth: 1 },
  tabbarShadow: { shadowColor: C.night, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  tabbar: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 50 },
  tabIcon: { width: 48, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, color: C.muted },
  celebrate: { position: 'absolute', alignSelf: 'center', backgroundColor: C.hero, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 14, alignItems: 'center', maxWidth: '88%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: C.night, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '90%' },
}) as const);
