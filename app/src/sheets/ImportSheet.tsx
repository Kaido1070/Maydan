import React, { useState } from 'react';
import { View } from 'react-native';
import { applyTechnicianImport, ImportPreview, ImportRow } from '../domain/importer';
import { useApply, useStore } from '../store';
import { Button, C, Chip, Row, Sheet, Spread, Sub, T } from '../ui/kit';

const ACTIONS: Record<ImportRow['action'], { label: string; tone: 'green' | 'purple' | 'neutral' | 'red' }> = {
  add: { label: 'جديد', tone: 'green' },
  update: { label: 'تحديث', tone: 'purple' },
  same: { label: 'بدون تغيير', tone: 'neutral' },
  error: { label: 'خطأ', tone: 'red' },
};

const ORDER: ImportRow['action'][] = ['error', 'add', 'update', 'same'];

/** معاينة ملف Excel قبل إضافة الفنيين. لا يتغير شيء حتى يضغط المستخدم «تطبيق». */
export function ImportSheet({ file, preview, onClose, onDone }: { file: string; preview: ImportPreview | null; onClose: () => void; onDone: (message: string) => void }) {
  const { mode } = useStore();
  const apply = useApply();
  const [limit, setLimit] = useState(60);
  if (!preview) return null;
  const changes = preview.added + preview.updated;
  const rows = [...preview.rows].sort((a, b) => ORDER.indexOf(a.action) - ORDER.indexOf(b.action) || a.line - b.line);

  const run = () => {
    const error = apply((ws) => applyTechnicianImport(ws, preview));
    if (error) return onDone(error);
    onDone('تم استيراد الفنيين: ' + preview.added + ' جديد، ' + preview.updated + ' تحديث');
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="استيراد الفنيين والفرق من Excel"
      sub={file}
      footer={
        preview.problem ? (
          <Button variant="secondary" label="إغلاق" onPress={onClose} />
        ) : (
          <Button testID="import-apply" label={changes ? 'تطبيق الاستيراد · ' + changes + ' فني' : 'ما فيه تغييرات'} disabled={!changes} onPress={run} />
        )
      }
    >
      <View style={{ backgroundColor: mode === 'demo' ? C.amberBg : C.greenBg, borderRadius: 12, padding: 10, marginBottom: 12 }}>
        <T style={{ fontWeight: '700', color: mode === 'demo' ? C.amber : C.green }}>
          {mode === 'demo' ? 'أنت في وضع التجربة' : 'الاستيراد إلى بيانات العمل'}
        </T>
        <Sub>
          {mode === 'demo'
            ? 'الفنيون راح ينضافون لوضع التجربة. لبياناتك الحقيقية، بدّل إلى «بيانات العمل» من أعلى الإعدادات ثم استورد.'
            : 'الملف يُقرأ على جهازك فقط، والبيانات تنحفظ على الجهاز وما ترفع لأي مكان.'}
        </Sub>
      </View>

      {preview.problem ? (
        <T style={{ color: C.red }}>{preview.problem}</T>
      ) : (
        <>
          <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            <Chip tone="green" label={'جديد ' + preview.added} />
            <Chip tone="purple" label={'تحديث ' + preview.updated} />
            <Chip tone="neutral" label={'بدون تغيير ' + preview.unchanged} />
            <Chip tone={preview.errors ? 'red' : 'neutral'} label={'أخطاء ' + preview.errors} />
          </Row>
          <Sub style={{ marginBottom: 6 }}>
            الفني يُعرف برقمه الوظيفي، والفريق برقمه أو باسمه داخل القسم. الصفوف اللي فيها أخطاء تنتجاهل، والفنيون غير الموجودين في الملف يبقون كما هم.
          </Sub>
          {rows.slice(0, limit).map((row) => (
            <Spread key={row.line} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 8, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 13 }}>{row.name || '—'}</T>
                <Sub>{'سطر ' + row.line + ' · ' + (row.kind === 'team' ? 'فريق' + (row.contractor ? ' · ' + row.contractor : '') + (row.employeeNumber ? ' · ' + row.employeeNumber : '') : row.employeeNumber || 'بدون رقم') + ' · ' + row.departmentName + ' · ' + row.shiftName + (row.active ? '' : ' · غير نشط')}</Sub>
                {row.error ? <T style={{ color: C.red, fontSize: 12 }}>{row.error}</T> : null}
              </View>
              <Chip tone={ACTIONS[row.action].tone} label={ACTIONS[row.action].label} />
            </Spread>
          ))}
          {rows.length > limit ? <Button small variant="ghost" label={'عرض المزيد · ' + (rows.length - limit)} onPress={() => setLimit(limit + 100)} /> : null}
        </>
      )}
    </Sheet>
  );
}
