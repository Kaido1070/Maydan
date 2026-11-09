import React from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { PLACE_NOUN, placeStatus } from '../domain/places';
import { visitDetails, visitTitle } from '../domain/records';
import { useStore } from '../store';
import { Button, C, Card, Chip, Empty, Icon, Row, SectionTitle, Spread, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';

/** زيارات المستودعات ونقاط الانطلاق: الهدف زيارة لكل مكان كل شهر. */
export function PlacesView() {
  const { ws, now } = useStore();
  const ui = useUi();
  const status = placeStatus(ws, now.date);
  const due = status.filter((item) => !item.visitedThisMonth).length;
  const placeIds = new Set(status.map((item) => item.place.id));
  const history = ws.visits.filter((visit) => visit.placeId && placeIds.has(visit.placeId)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 15);

  return (
    <View>
      <SectionTitle
        title="المستودعات ونقاط الانطلاق"
        sub={status.length ? (due ? 'باقي ' + due + ' ما انزارت هالشهر' : 'كلها انزارت هالشهر 👏') : 'أضفها من الإعدادات، وبعدها تسجّل زياراتها هنا.'}
        right={<Button small variant="secondary" icon="settings" label="إدارة" onPress={() => ui.go('settings')} />}
      />
      {status.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {status.map((item, index) => (
            <Spread key={item.place.id} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
              <Row style={{ flex: 1 }}>
                <Icon name={item.place.kind === 'warehouse' ? 'package' : 'navigation'} size={18} color={item.visitedThisMonth ? C.green : C.amber} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }}>{item.place.name}</T>
                  <Sub>{PLACE_NOUN[item.place.kind] + ' · ' + (item.lastVisit ? 'آخر زيارة ' + formatDate(item.lastVisit.date) : 'ما انزار أبدًا')}</Sub>
                  <Chip tone={item.visitedThisMonth ? 'green' : 'amber'} label={item.visitedThisMonth ? 'انزار هالشهر' : 'ما انزار هالشهر'} />
                </View>
              </Row>
              <Button testID={'place-visit-' + item.place.id} small label="سجّل" icon="map-pin" onPress={() => ui.openVisit({ departmentId: item.place.departmentId ?? '', placeId: item.place.id })} />
            </Spread>
          ))}
        </Card>
      ) : (
        <Card>
          <Empty text="ما فيه مستودعات أو نقاط انطلاق مضافة." />
        </Card>
      )}
      {history.length ? (
        <>
          <SectionTitle title="آخر زياراتها" />
          <Card style={{ paddingVertical: 4 }}>
            {history.map((visit, index) => (
              <Spread key={visit.id} style={{ paddingVertical: 9, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{visitTitle(visit)}</T>
                  <Sub>{formatDate(visit.date, { weekday: true }) + ' · ' + visit.time + (visitDetails(visit) ? ' · ' + visitDetails(visit) : '')}</Sub>
                </View>
                <Button small variant="secondary" label="تعديل" onPress={() => ui.openVisit({ departmentId: visit.departmentId, visitId: visit.id })} />
              </Spread>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}
