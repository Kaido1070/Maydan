import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { periodRange } from '../domain/shifts';
import { DayPlan, PlannedVisit, visitPlan } from '../domain/visitPlan';
import { useStore } from '../store';
import { Button, C, Chip, KIND, Row, Sheet, Spread, Sub, T } from './kit';
import { useUi } from './ui';

function PlannedRow({ visit, index, onStart }: { visit: PlannedVisit; index: number; onStart: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: KIND.visit.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ color: KIND.visit.fg, fontWeight: '700' }}>{index + 1}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '700' }}>{visit.department.name + (visit.shiftName !== visit.department.name ? ' · ' + visit.shiftName : '')}</T>
        <Sub numberOfLines={2}>{visit.technicians.map((tech) => tech.name).join('، ')}</Sub>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {visit.withoutVisit ? <Chip tone="red" label={visit.withoutVisit + ' بدون زيارة'} /> : null}
          <Chip tone="neutral" label={visit.technicians.length + (visit.technicians.length === 1 ? ' فني' : ' فنيين')} />
        </Row>
      </View>
      <Button small label="ابدأ" icon="map-pin" style={{ alignSelf: 'center', backgroundColor: KIND.visit.solid }} onPress={onStart} />
    </View>
  );
}

/** خطة الزيارات المقترحة: زيارات اليوم في صفحة اليوم، والأسبوع كامل في نافذة. */
export function VisitPlanCard() {
  const { ws, now } = useStore();
  const ui = useUi();
  const [week, setWeek] = useState(false);
  const plan: DayPlan[] = visitPlan(ws, now);
  const first = plan[0];
  const start = (visit: PlannedVisit) => {
    setWeek(false);
    ui.openVisit({ departmentId: visit.department.id, technicianIds: visit.technicians.map((tech) => tech.id) });
  };

  return (
    <View testID="visit-plan" style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 12 }}>
      <Spread>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700', fontSize: 16 }}>{first && first.date !== now.date ? 'خطة زيارات ' + formatDate(first.date, { weekday: true }) : 'خطة زيارات اليوم'}</T>
          <Sub>اقتراح حسب من يداوم وقت دوامك وناقصه زيارات</Sub>
        </View>
        {plan.length ? <Button testID="open-week-plan" small variant="secondary" label="الأسبوع" icon="calendar" onPress={() => setWeek(true)} /> : null}
      </Spread>
      {first ? (
        first.visits.map((visit, index) => <PlannedRow key={visit.department.id + visit.period.id} visit={visit} index={index} onStart={() => start(visit)} />)
      ) : (
        <Sub style={{ marginTop: 8 }}>ما فيه زيارات مقترحة باقي هالأسبوع. كل اللي يداومون وقت دوامك مكتملين 👏</Sub>
      )}

      {week ? (
        <Sheet visible onClose={() => setWeek(false)} title="خطة الأسبوع" sub={'حتى ' + ws.settings.dailyVisitGoal + ' زيارات في اليوم، والفني ما يتكرر'}>
          {plan.map((day) => (
            <View key={day.date} style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
              <Spread>
                <T style={{ fontWeight: '700' }}>{formatDate(day.date, { weekday: true })}</T>
                {day.date === now.date ? <Chip tone="purple" label="اليوم" /> : null}
              </Spread>
              {day.visits.map((visit, index) => (
                <View key={visit.department.id + visit.period.id}>
                  <PlannedRow visit={visit} index={index} onStart={() => start(visit)} />
                  <Sub style={{ fontSize: 11, marginTop: -6, marginBottom: 4, marginStart: 38 }}>{visit.period.name + ' · ' + periodRange(visit.period)}</Sub>
                </View>
              ))}
            </View>
          ))}
          <Sub>الخطة تتحدث تلقائيًا كل ما سجلت زيارة أو تغيّر الجدول.</Sub>
        </Sheet>
      ) : null}
    </View>
  );
}
