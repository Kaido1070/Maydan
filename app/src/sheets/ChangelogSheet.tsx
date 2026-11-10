import React from 'react';
import { View } from 'react-native';
import { formatDate } from '../domain/dates';
import { APP_VERSION, CHANGELOG, Release, versionLabel } from '../version';
import { Button, C, Chip, Icon, Row, Sheet, Spread, Sub, T } from '../ui/kit';

function ReleaseCard({ release, current }: { release: Release; current: boolean }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: current ? C.softLine : C.line, padding: 12, marginBottom: 10 }}>
      <Spread>
        <Row gap={6}>
          <T style={{ fontWeight: '800', fontSize: 16 }}>{'⁦' + release.version + '⁩'}</T>
          {current ? <Chip tone="purple" label="المثبت الآن" /> : null}
        </Row>
        <Sub>{formatDate(release.date, { year: true })}</Sub>
      </Spread>
      <T style={{ fontWeight: '700', marginTop: 2, marginBottom: 6 }}>{release.title}</T>
      {release.changes.map((change) => (
        <Row key={change} gap={6} style={{ alignItems: 'flex-start', marginTop: 4 }}>
          <View style={{ paddingTop: 3 }}>
            <Icon name="check" size={13} color={C.green} />
          </View>
          <T style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{change}</T>
        </Row>
      ))}
    </View>
  );
}

/** صفحة سجل التحديثات: كل إصدار وما تغيّر فيه. */
export function ChangelogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <Sheet visible onClose={onClose} title="سجل التحديثات" sub={'الإصدار المثبت: ' + versionLabel()}>
      {CHANGELOG.map((release) => (
        <ReleaseCard key={release.version} release={release} current={release.version === APP_VERSION} />
      ))}
    </Sheet>
  );
}

/** نافذة «الجديد في هذا التحديث» تظهر مرة واحدة بعد تثبيت إصدار جديد. */
export function WhatsNewSheet({ releases, onClose, onShowAll }: { releases: Release[]; onClose: () => void; onShowAll: () => void }) {
  if (!releases.length) return null;
  return (
    <Sheet
      visible
      onClose={onClose}
      title="الجديد في هذا التحديث"
      sub={'ميدان ' + versionLabel()}
      footer={
        <Row>
          <Button testID="whats-new-ok" style={{ flex: 1 }} label="تمام" onPress={onClose} />
          <Button variant="secondary" label="كل التحديثات" onPress={onShowAll} />
        </Row>
      }
    >
      {releases.map((release) => (
        <ReleaseCard key={release.version} release={release} current={release.version === APP_VERSION} />
      ))}
    </Sheet>
  );
}
