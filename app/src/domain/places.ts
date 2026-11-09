import { newId } from './records';
import type { Place, PlaceKind, Visit, Workspace } from './types';

export const PLACE_NOUN: Record<PlaceKind, string> = { warehouse: 'مستودع', staging: 'نقطة انطلاق' };
export const PLACE_WORK_TYPE: Record<PlaceKind, string> = { warehouse: 'زيارة مستودع', staging: 'زيارة نقطة انطلاق' };

export const placesOf = (ws: Workspace): Place[] => ws.places ?? [];

export function addPlace(ws: Workspace, input: { kind: PlaceKind; name: string; departmentId?: string }): Workspace {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('اكتب اسم ال' + PLACE_NOUN[input.kind]);
  if (placesOf(ws).some((place) => place.name === name)) throw new Error('الاسم موجود بالفعل');
  return { ...ws, places: [...placesOf(ws), { id: newId('pl'), kind: input.kind, name, ...(input.departmentId ? { departmentId: input.departmentId } : {}) }] };
}

export const deletePlace = (ws: Workspace, id: string): Workspace => ({ ...ws, places: placesOf(ws).filter((place) => place.id !== id) });

export type PlaceStatus = { place: Place; lastVisit?: Visit; visitedThisMonth: boolean; visitsThisMonth: number; visitedThisQuarter: boolean };

export const DEFAULT_WAREHOUSE_QUARTER_GOAL = 2;

/** بداية ونهاية ربع السنة اللي فيه التاريخ (النهاية غير شاملة). */
export function quarterOf(date: string): { index: number; start: string; end: string; label: string } {
  const year = Number(date.slice(0, 4));
  const index = Math.floor((Number(date.slice(5, 7)) - 1) / 3);
  const key = (y: number, month: number) => y + '-' + String(month + 1).padStart(2, '0') + '-01';
  return { index, start: key(year, index * 3), end: index === 3 ? key(year + 1, 0) : key(year, index * 3 + 3), label: 'الربع ' + ['الأول', 'الثاني', 'الثالث', 'الرابع'][index] };
}

export type WarehouseQuarter = { goal: number; visited: number; remaining: number; label: string; daysLeft: number; total: number };

/** هدف المستودعات: عدد مستودعات مختلفة تنزار كل ربع سنة (افتراضيًا 2). */
export function warehouseQuarter(ws: Workspace, today: string): WarehouseQuarter {
  const quarter = quarterOf(today);
  const warehouses = placesOf(ws).filter((place) => place.kind === 'warehouse');
  const ids = new Set(warehouses.map((place) => place.id));
  const visited = new Set(ws.visits.filter((visit) => visit.placeId && ids.has(visit.placeId) && visit.date >= quarter.start && visit.date < quarter.end && visit.date <= today).map((visit) => visit.placeId)).size;
  const goal = Math.max(1, ws.settings.warehouseQuarterGoal ?? DEFAULT_WAREHOUSE_QUARTER_GOAL);
  const daysLeft = Math.round((new Date(quarter.end + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000);
  return { goal, visited, remaining: Math.max(0, goal - visited), label: quarter.label, daysLeft, total: warehouses.length };
}

/** حالة كل مكان: آخر زيارة، وهل انزار هالشهر وهالربع. */
export function placeStatus(ws: Workspace, today: string): PlaceStatus[] {
  const month = today.slice(0, 7);
  const quarter = quarterOf(today);
  return placesOf(ws)
    .map((place) => {
      const visits = ws.visits.filter((visit) => visit.placeId === place.id && visit.date <= today).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      const thisMonth = visits.filter((visit) => visit.date.startsWith(month));
      return { place, lastVisit: visits[0], visitedThisMonth: thisMonth.length > 0, visitsThisMonth: thisMonth.length, visitedThisQuarter: visits.some((visit) => visit.date >= quarter.start && visit.date < quarter.end) };
    })
    .sort((a, b) => Number(a.visitedThisQuarter) - Number(b.visitedThisQuarter) || (a.lastVisit?.date ?? '').localeCompare(b.lastVisit?.date ?? '') || a.place.name.localeCompare(b.place.name, 'ar'));
}

export function renamePlace(ws: Workspace, id: string, input: { name: string; kind: PlaceKind }): Workspace {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('اكتب الاسم');
  if (placesOf(ws).some((place) => place.name === name && place.id !== id)) throw new Error('الاسم موجود بالفعل');
  return { ...ws, places: placesOf(ws).map((place) => (place.id === id ? { ...place, name, kind: input.kind } : place)) };
}

/** زيارات معدات التوزيع، الأحدث أولًا. */
export const equipmentVisits = (ws: Workspace): Visit[] =>
  ws.visits.filter((visit) => visit.target === 'equipment').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
