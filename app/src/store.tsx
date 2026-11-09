import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { riyadhNow } from './domain/dates';
import { defaultDepartments, demoWorkspace, emptyWorkspace } from './domain/seed';
import type { AppState, Mode, Now, Workspace } from './domain/types';

const STORAGE_KEY = 'maydan-app-state-v1';

type Store = {
  ready: boolean;
  mode: Mode;
  ws: Workspace;
  now: Now;
  /** يطبّق تعديلًا على مساحة العمل الحالية (التجربة أو العمل). يرمي الخطأ للواجهة. */
  update: (change: (ws: Workspace) => Workspace) => void;
  setMode: (mode: Mode) => void;
  resetDemo: () => void;
  resetLive: () => void;
  replaceLive: (ws: Workspace) => void;
  exportBackup: () => string;
};

const StoreContext = createContext<Store | null>(null);

/** ترقية بيانات الإصدارات السابقة. */
export function migrate(state: AppState): AppState {
  // 1.3.0: الإنشاءات صارت مشاريع. بيانات التجربة تتجدد، وبيانات العمل يتحدث فيها نوع القسم فقط.
  const construction = (ws: Workspace) => ws.departments.find((d) => d.id === 'e' && d.name.includes('الإنشاءات'));
  const demoOld = construction(state.demo) && construction(state.demo)!.entryKind === undefined;
  const live = construction(state.live) && construction(state.live)!.entryKind === undefined
    ? { ...state.live, departments: state.live.departments.map((d) => (d === construction(state.live) ? { ...d, entryKind: 'project' as const } : d)) }
    : state.live;
  // 1.4.0: قسم التشغيل. بيانات العمل ينضاف لها القسم، وبيانات التجربة تتجدد.
  const operations = defaultDepartments(riyadhNow().date).find((d) => d.id === 'f')!;
  const hasOps = (ws: Workspace) => ws.departments.some((d) => d.name === 'التشغيل');
  const liveOps = hasOps(live) ? live : { ...live, departments: [...live.departments, { ...operations, id: live.departments.some((d) => d.id === 'f') ? 'ops' : 'f', shifts: [{ id: 'ops-A', name: 'التشغيل' }] }] };
  const demo = demoOld || !hasOps(state.demo) || !state.demo.places ? demoWorkspace(riyadhNow().date) : state.demo;
  return { ...state, demo, live: liveOps };
}

function initialState(today: string): AppState {
  return { version: 1, mode: 'demo', demo: demoWorkspace(today), live: emptyWorkspace(today) };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<Now>(() => riyadhNow());
  const [state, setState] = useState<AppState>(() => initialState(riyadhNow().date));
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as AppState;
        if (parsed?.version === 1 && parsed.demo && parsed.live) setState(migrate(parsed));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state, ready]);

  // تحديث الوقت كل 30 ثانية حتى يتبدل الشفت الحالي تلقائيًا.
  useEffect(() => {
    const timer = setInterval(() => {
      const next = riyadhNow();
      setNow((prev) => (prev.date === next.date && prev.time === next.time ? prev : next));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const update = useCallback((change: (ws: Workspace) => Workspace) => {
    // نحسب التعديل خارج setState حتى تصل الأخطاء للواجهة.
    setState((prev) => {
      const next = change(prev[prev.mode]);
      return { ...prev, [prev.mode]: next };
    });
  }, []);

  const store = useMemo<Store>(
    () => ({
      ready,
      mode: state.mode,
      ws: state[state.mode],
      now,
      update,
      setMode: (mode) => setState((prev) => ({ ...prev, mode })),
      resetDemo: () => setState((prev) => ({ ...prev, demo: demoWorkspace(riyadhNow().date) })),
      resetLive: () => setState((prev) => ({ ...prev, live: emptyWorkspace(riyadhNow().date) })),
      replaceLive: (ws) => setState((prev) => ({ ...prev, live: ws })),
      exportBackup: () => JSON.stringify(state.live, null, 2),
    }),
    [ready, state, now, update],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider missing');
  return store;
}

/**
 * يطبّق تعديلًا ويرجع رسالة الخطأ إن وجدت. نتحقق من التعديل مرة على الحالة الحالية
 * قبل إرساله، لأن setState لا يمرّر الاستثناءات للمستدعي.
 */
export function useApply() {
  const { ws, update } = useStore();
  return useCallback(
    (change: (ws: Workspace) => Workspace): string | null => {
      try {
        change(ws);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      update(change);
      return null;
    },
    [ws, update],
  );
}
