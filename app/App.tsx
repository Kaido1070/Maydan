import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useAppFonts } from './src/ui/fonts';
import { Tab, Ui, UiContext } from './src/ui/ui';
import { APP_VERSION, Release, releasesSince } from './src/version';

/** آخر إصدار شاف المستخدم نافذة «الجديد» حقه. */
export const SEEN_VERSION_KEY = 'maydan-seen-version';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'day', label: 'اليوم', icon: 'grid' },
  { id: 'visits', label: 'الزيارات', icon: 'map-pin' },
  { id: 'meetings', label: 'الاجتماعات', icon: 'users' },
  { id: 'reports', label: 'التقارير', icon: 'bar-chart-2' },
  { id: 'roster', label: 'الشفتات', icon: 'calendar' },
];

const TITLES: Record<Tab, string> = {
  day: 'مهام اليوم',
  visits: 'الزيارات',
  meetings: 'الاجتماعات',
  reports: 'الإحصائيات والتقارير',
  roster: 'جدول الشفتات',
  settings: 'الإعدادات',
};

function Shell() {
  const insets = useSafeAreaInsets();
  const { mode, ready } = useStore();
  const [tab, setTab] = useState<Tab>('day');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
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
        setTab(next);
        scroll.current?.scrollTo({ y: 0, animated: false });
      },
      notify: (message) => {
        clearTimeout(toastTimer.current);
        setToast(message);
        toastTimer.current = setTimeout(() => setToast(null), 3000);
      },
      openVisit: setVisit,
      openTechnician: (id, date) => setTechnician({ id, date }),
      openSlot: setSlot,
      openChangelog: () => setChangelog(true),
      openPerson: setPerson,
      focusMeetingId,
      departmentId,
      setDepartmentId,
      rosterDate,
      setRosterDate,
    }),
    [tab, departmentId, rosterDate, focusMeetingId],
  );

  const Screen = { day: TodayScreen, visits: VisitsScreen, meetings: MeetingsScreen, reports: ReportsScreen, roster: RosterScreen, settings: SettingsScreen }[tab];

  return (
    <UiContext.Provider value={ui}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Icon name="shield" size={20} color="#211345" />
            </View>
            <View>
              <Text style={styles.brandName}>ميدان</Text>
              <Text style={styles.brandSub}>{TITLES[tab]}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === 'demo' ? 'وضع التجربة مفعّل. افتح الإعدادات للتبديل' : 'وضع العمل'}
              onPress={() => ui.go('settings')}
              style={[styles.modeBadge, mode === 'demo' ? styles.demo : styles.live]}
              testID="mode-badge"
            >
              <View style={[styles.dot, { backgroundColor: mode === 'demo' ? '#ffd27a' : '#7ce0b0' }]} />
              <Text style={styles.modeText}>{mode === 'demo' ? 'وضع التجربة' : 'بيانات العمل'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="الإعدادات" onPress={() => ui.go('settings')} style={styles.gear} testID="open-settings">
              <Icon name="settings" size={18} color="#ddd8ec" />
            </Pressable>
          </View>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {ready ? <Screen /> : null}
        </ScrollView>

        <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <Pressable
                key={item.id}
                testID={'tab-' + item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={() => ui.go(item.id)}
                style={styles.tab}
              >
                <View style={[styles.tabIcon, active && { backgroundColor: C.soft }]}>
                  <Icon name={item.icon} size={20} color={active ? C.purple : '#8a849c'} />
                </View>
                <Text style={[styles.tabText, active && { color: C.purple, fontWeight: '800' }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {toast ? (
          <View pointerEvents="none" style={[styles.toast, { bottom: Math.max(insets.bottom, 8) + 74 }]} accessibilityLiveRegion="polite">
            <Text style={{ color: '#fff', fontSize: 13 }}>{toast}</Text>
          </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#fff', fontSize: 19, fontWeight: '800' },
  brandSub: { color: '#cfc9e0', fontSize: 12 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  demo: { backgroundColor: '#3a2d18', borderColor: '#6b5320' },
  live: { backgroundColor: '#163528', borderColor: '#24614a' },
  modeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  gear: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#2a2440', alignItems: 'center', justifyContent: 'center' },
  tabbar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 50 },
  tabIcon: { width: 44, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, color: '#5f5975' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#251a42', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '90%' },
});
