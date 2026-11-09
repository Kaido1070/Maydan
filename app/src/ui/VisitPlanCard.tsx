import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { PLACE_NOUN } from '../domain/places';
import { periodRange } from '../domain/shifts';
import { DayPlan, PlanItem, PlannedPlace, PlannedVisit, visitPlan } from '../domain/visitPlan';
import { useStore } from '../store';
import { Button, C, Chip, Icon, KIND, Row, Sheet, Spread, Sub, T } from './kit';
import { useUi } from './ui';

function Badge({ index, tone }: { index: number; tone: 'visit' | 'meeting' | 'place' }) {
  const colors = tone === 'place' ? { bg: '#eef6ee', fg: C.green } : { bg: KIND[tone].bg, fg: KIND[tone].fg };
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ color: colors.fg, fontWeight: '700' }}>{index + 1}</T>
    </View>
  );
}

function CrewRow({ visit, index, showPeriod, onAct }: { visit: PlannedVisit; index: number; showPeriod?: boolean; onAct?: () => void }) {
  const ui = useUi();
  const onlyMeeting = !visit.technicians.length;
  const title = visit.department.name + (visit.shiftName !== visit.department.name ? ' · ' + visit.shiftName : '');
  const startVisit = () => (onAct?.(), ui.openVisit({ departmentId: visit.department.id, technicianIds: visit.technicians.map((tech) => tech.id) }));
  const startMeeting = () => visit.meeting && (onAct?.(), ui.go('meetings', { departmentId: visit.department.id, meetingId: visit.meeting.meeting.id }));
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
      <Badge index={index} tone={onlyMeeting ? 'meeting' : 'visit'} />
      <View style={{ flex: 1, gap: 3 }}>
        <T style={{ fontWeight: '700' }}>{title}</T>
        {showPeriod ? <Sub style={{ fontSize: 11 }}>{visit.period.name + ' · ' + periodRange(visit.period)}</Sub> : null}
        {visit.technicians.length ? (
          <>
            <Sub numberOfLines={2}>{visit.technicians.map((tech) => tech.name).join('، ')}</Sub>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {visit.withoutVisit ? <Chip tone="red" label={visit.withoutVisit + ' بدون زيارة'} /> : null}
              <Chip tone="neutral" label={visit.technicians.length + (visit.technicians.length === 1 ? ' فني' : ' فنيين')} />
            </Row>
          </>
        ) : null}
        {visit.meeting ? (
          <View style={{ backgroundColor: KIND.meeting.bg, borderRadius: 10, padding: 8, marginTop: 4, gap: 4 }}>
            <Row gap={6}>
              <Icon name="users" size={14} color={KIND.meeting.fg} />
              <T style={{ flex: 1, fontSize: 14, color: KIND.meeting.fg, fontWeight: '600' }}>{'اجتماع مقترح: ' + visit.meeting.meeting.title}</T>
            </Row>
            <Sub numberOfLines={2}>{'ما حضروه: ' + visit.meeting.people.map((tech) => tech.name).join('، ')}</Sub>
            <Button testID="plan-meeting" small variant="secondary" icon="check-square" label={'سجّل حضورهم · ' + visit.meeting.people.length} onPress={startMeeting} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
      </View>
      {visit.technicians.length ? (
        <Button testID="plan-start" small label="ابدأ" icon="map-pin" style={{ alignSelf: 'flex-start', backgroundColor: KIND.visit.solid }} onPress={startVisit} />
      ) : null}
    </View>
  );
}

function PlaceRow({ item, index, onAct }: { item: PlannedPlace; index: number; onAct?: () => void }) {
  const ui = useUi();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line, alignItems: 'center' }}>
      <Badge index={index} tone="place" />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '700' }}>{item.place.name}</T>
        <Sub>{PLACE_NOUN[item.place.kind] + ' · ' + (item.lastVisitDate ? 'آخر زيارة ' + formatDate(item.lastVisitDate) : 'ما انزار أبدًا') + ' · ما انزار هالشهر'}</Sub>
      </View>
      <Button testID="plan-place" small label="ابدأ" icon={item.place.kind === 'warehouse' ? 'package' : 'navigation'} style={{ backgroundColor: C.green }} onPress={() => (onAct?.(), ui.openVisit({ departmentId: item.place.departmentId ?? '', placeId: item.place.id }))} />
    </View>
  );
}

function Item({ item, index, showPeriod, onAct }: { item: PlanItem; index: number; showPeriod?: boolean; onAct?: () => void }) {
  return item.kind === 'place' ? <PlaceRow item={item} index={index} onAct={onAct} /> : <CrewRow visit={item} index={index} showPeriod={showPeriod} onAct={onAct} />;
}

const itemKey = (item: PlanItem) => (item.kind === 'place' ? 'place-' + item.place.id : item.department.id + item.period.id);

/** خطة اليوم: زيارات مقترحة، ومعها اجتماع مقترح من عناوينك، ومستودع أو نقطة انطلاق. */
export function VisitPlanCard() {
  const { ws, now } = useStore();
  const [week, setWeek] = useState(false);
  const plan: DayPlan[] = visitPlan(ws, now);
  const first = plan[0];

  return (
    <View testID="visit-plan" style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 12 }}>
      <Spread>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700', fontSize: 16 }}>{first && first.date !== now.date ? 'خطة ' + formatDate(first.date, { weekday: true }) : 'خطة اليوم'}</T>
          <Sub>زيارات واجتماعات حسب من يداوم وقت دوامك وما خلّص</Sub>
        </View>
        {plan.length ? <Button testID="open-week-plan" small variant="secondary" label="الأسبوع" icon="calendar" onPress={() => setWeek(true)} /> : null}
      </Spread>
      {first ? (
        first.visits.map((item, index) => <Item key={itemKey(item)} item={item} index={index} />)
      ) : (
        <Sub style={{ marginTop: 8 }}>ما فيه اقتراحات باقي هالأسبوع. اللي يداومون وقت دوامك مكتملين 👏</Sub>
      )}

      {week ? (
        <Sheet visible onClose={() => setWeek(false)} title="خطة الأسبوع" sub={'حتى ' + ws.settings.dailyVisitGoal + ' زيارات فنيين في اليوم، ومستودع أو نقطة انطلاق، والاجتماعات من عناوينك'}>
          {plan.map((day) => (
            <View key={day.date} style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
              <Spread>
                <T style={{ fontWeight: '700' }}>{formatDate(day.date, { weekday: true })}</T>
                {day.date === now.date ? <Chip tone="purple" label="اليوم" /> : null}
              </Spread>
              {day.visits.map((item, index) => (
                <Item key={itemKey(item)} item={item} index={index} showPeriod onAct={() => setWeek(false)} />
              ))}
            </View>
          ))}
          <Sub>الخطة تتحدث تلقائيًا كل ما سجلت زيارة أو حضور أو تغيّر الجدول.</Sub>
        </Sheet>
      ) : null}
    </View>
  );
}
