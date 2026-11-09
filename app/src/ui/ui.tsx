import { createContext, useContext } from 'react';
import type { SlotTarget } from '../sheets/ShiftSheets';
import type { VisitTarget } from '../sheets/VisitSheet';

export type Tab = 'day' | 'visits' | 'meetings' | 'follow' | 'reports' | 'roster' | 'settings';

export type Ui = {
  tab: Tab;
  go: (tab: Tab, options?: { departmentId?: string; date?: string; meetingId?: string }) => void;
  focusMeetingId: string | null;
  notify: (message: string) => void;
  /** رسالة إنجاز تنضاف للرسالة الحالية (مستوى جديد، هدف الأسبوع...). */
  celebrateMilestone: (message: string) => void;
  openVisit: (target: NonNullable<VisitTarget>) => void;
  openTechnician: (id: string, date?: string) => void;
  openSlot: (target: NonNullable<SlotTarget>) => void;
  openChangelog: () => void;
  /** تسجيل عمل خارج الدوام (null = جديد). */
  openOvertime: (id: string | null) => void;
  /** تفاصيل فني أو فريق: سجله وأزرار التسجيل. */
  openPerson: (id: string) => void;
  /** القسم المختار المشترك بين شاشتي الزيارات والاجتماعات */
  departmentId: string | null;
  setDepartmentId: (id: string | null) => void;
  rosterDate: string | null;
  setRosterDate: (date: string) => void;
};

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('UiContext missing');
  return ui;
}
