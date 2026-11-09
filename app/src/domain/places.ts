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

export type PlaceStatus = { place: Place; lastVisit?: Visit; visitedThisMonth: boolean; visitsThisMonth: number };

/** حالة كل مكان: آخر زيارة، وهل انزار هالشهر (الهدف زيارة شهرية على الأقل). */
export function placeStatus(ws: Workspace, today: string): PlaceStatus[] {
  const month = today.slice(0, 7);
  return placesOf(ws)
    .map((place) => {
      const visits = ws.visits.filter((visit) => visit.placeId === place.id && visit.date <= today).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      const thisMonth = visits.filter((visit) => visit.date.startsWith(month));
      return { place, lastVisit: visits[0], visitedThisMonth: thisMonth.length > 0, visitsThisMonth: thisMonth.length };
    })
    .sort((a, b) => Number(a.visitedThisMonth) - Number(b.visitedThisMonth) || (a.lastVisit?.date ?? '').localeCompare(b.lastVisit?.date ?? '') || a.place.name.localeCompare(b.place.name, 'ar'));
}
