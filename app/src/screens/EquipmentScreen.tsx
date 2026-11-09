import React, { useEffect, useState } from 'react';
import { Image, Modal, TextInput, View } from 'react-native';
import { addDays, formatDate } from '../domain/dates';
import { deleteEquipment, equipmentOf, EquipmentInput, saveEquipment, validateEquipment } from '../domain/equipment';
import type { EquipmentRecord, Photo } from '../domain/types';
import { deletePhotoFiles, photoSrc, pickPhotos } from '../photos';
import { confirm } from '../sheets/VisitSheet';
import { useApply, useStore } from '../store';
import { Button, C, Card, Chip, Empty, Field, Icon, Row, s, SectionTitle, Sheet, Spread, Stepper, Sub, T } from '../ui/kit';
import { useUi } from '../ui/ui';
import { Touch } from '../ui/touch';

export function EquipmentScreen() {
  const { ws } = useStore();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const list = equipmentOf(ws);

  return (
    <View>
      <SectionTitle
        title="معدات التوزيع"
        sub="سجّل المعدة وأرفق صورها قبل وبعد. الصور تنحفظ على جهازك فقط."
        right={<Button testID="add-equipment" icon="plus" label="إضافة معدة" onPress={() => setEditing('new')} />}
      />
      {list.length ? (
        list.map((record) => <EquipmentCard key={record.id} record={record} onPress={() => setEditing(record.id)} />)
      ) : (
        <Card>
          <Empty text="ما فيه معدات مسجلة. اضغط «إضافة معدة» وصوّرها قبل وبعد." />
        </Card>
      )}
      <EquipmentSheet recordId={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function EquipmentCard({ record, onPress }: { record: EquipmentRecord; onPress: () => void }) {
  const cover = (photos: Photo[], label: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Sub style={{ fontSize: 11 }}>{label}</Sub>
      {photos[0] ? (
        <Image source={{ uri: photoSrc(photos[0]) }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: '#eee' }} />
      ) : (
        <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: '#f2f0f7', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="image" color={C.muted} />
        </View>
      )}
    </View>
  );
  return (
    <Touch testID={'equipment-' + record.id} accessibilityRole="button" accessibilityLabel={record.name} onPress={onPress}>
      <Card>
        <Spread style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '800', fontSize: 16 }}>{record.name}</T>
            <Sub>{formatDate(record.date, { weekday: true, year: true }) + (record.location ? ' · ' + record.location : '')}</Sub>
          </View>
          <Row gap={4}>
            <Chip tone={record.before.length ? 'purple' : 'neutral'} label={'قبل ' + record.before.length} />
            <Chip tone={record.after.length ? 'green' : 'neutral'} label={'بعد ' + record.after.length} />
          </Row>
        </Spread>
        <Row style={{ marginTop: 10 }} gap={8}>
          {cover(record.before, 'قبل')}
          {cover(record.after, 'بعد')}
        </Row>
      </Card>
    </Touch>
  );
}

const EMPTY: EquipmentInput = { name: '', location: '', notes: '', date: '', before: [], after: [] };

/** إضافة أو تعديل معدة بصور قبل وبعد. */
function EquipmentSheet({ recordId, onClose }: { recordId: string | 'new' | null; onClose: () => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const ui = useUi();
  const existing = (ws.equipment ?? []).find((item) => item.id === recordId);
  const [draft, setDraft] = useState<EquipmentInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Photo | null>(null);

  useEffect(() => {
    if (!recordId) return;
    setDraft(existing ? { ...existing } : { ...EMPTY, date: now.date });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  if (!recordId) return null;
  const original = existing ? [...existing.before, ...existing.after] : [];
  const current = [...draft.before, ...draft.after];
  const ids = (photos: Photo[]) => new Set(photos.map((photo) => photo.id));

  const close = () => {
    // الصور اللي انضافت وما انحفظت تنحذف من الجهاز.
    const kept = ids(original);
    deletePhotoFiles(current.filter((photo) => !kept.has(photo.id)));
    onClose();
  };

  const add = async (side: 'before' | 'after', source: 'camera' | 'library') => {
    setBusy(true);
    setError(null);
    try {
      const photos = await pickPhotos(source);
      if (photos.length) setDraft((prev) => ({ ...prev, [side]: [...prev[side], ...photos] }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = (side: 'before' | 'after', photo: Photo) =>
    setDraft((prev) => ({ ...prev, [side]: prev[side].filter((item) => item.id !== photo.id) }));

  const save = () => {
    const problem = validateEquipment(draft);
    if (problem) return setError(problem);
    const failure = apply((ws) => saveEquipment(ws, draft, existing?.id).ws);
    if (failure) return setError(failure);
    const kept = ids(current);
    deletePhotoFiles(original.filter((photo) => !kept.has(photo.id)));
    ui.notify(existing ? 'تم حفظ التعديل' : 'تم حفظ المعدة');
    onClose();
  };

  const removeRecord = () =>
    confirm('حذف «' + existing!.name + '» مع صوره؟', () => {
      apply((ws) => deleteEquipment(ws, existing!.id));
      deletePhotoFiles([...original, ...current]);
      ui.notify('تم حذف المعدة');
      onClose();
    });

  const section = (side: 'before' | 'after', title: string) => (
    <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
      <Spread>
        <T style={{ fontWeight: '800', fontSize: 16 }}>{title}</T>
        <Chip tone={draft[side].length ? (side === 'before' ? 'purple' : 'green') : 'neutral'} label={draft[side].length + ' صورة'} />
      </Spread>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {draft[side].map((photo) => (
          <View key={photo.id} style={{ width: '31%' }}>
            <Touch accessibilityRole="imagebutton" accessibilityLabel={'عرض صورة ' + title} onPress={() => setViewer(photo)}>
              <Image source={{ uri: photoSrc(photo) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#eee' }} />
            </Touch>
            <Touch
              accessibilityRole="button"
              accessibilityLabel="حذف الصورة"
              onPress={() => remove(side, photo)}
              hitSlop={8}
              style={{ position: 'absolute', top: 4, left: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="x" size={14} color="#fff" />
            </Touch>
          </View>
        ))}
      </View>
      <Row style={{ marginTop: 10 }}>
        <Button testID={side + '-camera'} small style={{ flex: 1 }} variant="secondary" icon="camera" label="الكاميرا" disabled={busy} onPress={() => add(side, 'camera')} />
        <Button testID={side + '-library'} small style={{ flex: 1 }} variant="secondary" icon="image" label="من الصور" disabled={busy} onPress={() => add(side, 'library')} />
      </Row>
    </View>
  );

  return (
    <Sheet
      visible
      onClose={close}
      title={existing ? 'تعديل معدة' : 'إضافة معدة'}
      sub="صور قبل وبعد"
      footer={
        <>
          {error ? <T style={{ color: C.red, fontSize: 13 }}>{error}</T> : null}
          <Row>
            <Button testID="equipment-save" style={{ flex: 1 }} label={busy ? 'جاري تجهيز الصور...' : 'حفظ'} disabled={busy} onPress={save} />
            {existing ? <Button variant="danger" label="حذف" onPress={removeRecord} /> : null}
          </Row>
        </>
      }
    >
      <Field testID="equipment-name" label="اسم المعدة أو رقمها" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="مثال: محول 500 ك.ف.أ رقم 1234" />
      <Field testID="equipment-location" label="الموقع (اختياري)" value={draft.location} onChangeText={(location) => setDraft({ ...draft, location })} placeholder="مثال: حي الروضة، شارع ..." />
      <Spread style={{ marginBottom: 12 }}>
        <T style={{ fontWeight: '700', fontSize: 13 }}>التاريخ</T>
        <Stepper
          label={draft.date ? formatDate(draft.date) : ''}
          onPrev={() => setDraft({ ...draft, date: addDays(draft.date, -1) })}
          onNext={() => setDraft({ ...draft, date: addDays(draft.date, 1) })}
          nextDisabled={draft.date >= now.date}
        />
      </Spread>
      {section('before', 'قبل')}
      {section('after', 'بعد')}
      <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 4 }}>ملاحظات (اختياري)</T>
      <TextInput
        testID="equipment-notes"
        value={draft.notes}
        onChangeText={(notes) => setDraft({ ...draft, notes })}
        multiline
        placeholder="وصف العمل أو الملاحظة"
        placeholderTextColor="#a29db3"
        style={[s.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
      />

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Touch accessibilityRole="button" accessibilityLabel="إغلاق الصورة" onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          {viewer ? <Image source={{ uri: photoSrc(viewer) }} resizeMode="contain" style={{ width: '100%', height: '85%' }} /> : null}
          <Sub style={{ color: '#fff', marginTop: 10 }}>اضغط للإغلاق</Sub>
        </Touch>
      </Modal>
    </Sheet>
  );
}
