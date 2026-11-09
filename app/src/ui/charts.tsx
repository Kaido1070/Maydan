import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { C, Icon, IconName, Row, Spread, Sub, T } from './kit';

/** ألوان الرسوم (تم التحقق منها لعمى الألوان): الزيارات أزرق، الاجتماعات برتقالي. */
export const CHART = {
  visits: '#2a78d6',
  meetings: '#eb6834',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
};

export type Series = { name: string; color: string };

function Legend({ series }: { series: Series[] }) {
  return (
    <Row gap={14} style={{ flexWrap: 'wrap', marginBottom: 8 }}>
      {series.map((item) => (
        <Row key={item.name} gap={6}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color }} />
          <Sub style={{ color: C.ink }}>{item.name}</Sub>
        </Row>
      ))}
    </Row>
  );
}

const niceMax = (value: number) => {
  if (value <= 4) return Math.max(1, value);
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / step) * step;
};

/**
 * أعمدة مجمّعة عبر الفترة (أسابيع أو أشهر). اضغط على أي فترة لعرض أرقامها.
 * محور واحد، وخطوط شبكة خفيفة، وقيمة كل عمود تظهر عند الاختيار.
 */
export function ColumnChart({ buckets, series, height = 170 }: { buckets: { label: string; values: number[] }[]; series: Series[]; height?: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const peak = niceMax(Math.max(0, ...buckets.flatMap((bucket) => bucket.values)));
  const ticks = [peak, peak / 2, 0];
  const focus = selected ?? buckets.reduce((best, bucket, index) => (bucket.values.reduce((a, b) => a + b, 0) > buckets[best].values.reduce((a, b) => a + b, 0) ? index : best), 0);
  const current = buckets[focus];

  return (
    <View>
      <Legend series={series} />
      {current ? (
        <View style={{ backgroundColor: '#f7f5fb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}>
          <Spread>
            <T style={{ fontWeight: '700', fontSize: 13 }}>{current.label}</T>
            <Row gap={12}>
              {series.map((item, index) => (
                <Row key={item.name} gap={5}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.color }} />
                  <T style={{ fontSize: 13 }}>{item.name + ' ' + current.values[index]}</T>
                </Row>
              ))}
            </Row>
          </Spread>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', height }}>
        <View style={{ justifyContent: 'space-between', paddingBottom: 18, marginEnd: 6 }}>
          {ticks.map((tick) => (
            <Sub key={tick} style={{ fontSize: 11, color: CHART.muted, lineHeight: 14 }}>
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </Sub>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            {ticks.map((tick, index) => (
              <View key={tick} style={{ height: 1, backgroundColor: index === ticks.length - 1 ? CHART.axis : CHART.grid }} />
            ))}
          </View>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
            {buckets.map((bucket, index) => {
              const active = index === focus;
              return (
                <Pressable
                  key={bucket.label}
                  accessibilityRole="button"
                  accessibilityLabel={bucket.label + ': ' + series.map((item, i) => item.name + ' ' + bucket.values[i]).join('، ')}
                  onPress={() => setSelected(index)}
                  style={{ flex: 1, alignItems: 'center' }}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 3, opacity: active ? 1 : 0.55 }}>
                    {bucket.values.map((value, i) => (
                      <View
                        key={series[i].name}
                        style={{
                          width: Math.max(6, Math.min(16, 120 / buckets.length)),
                          height: `${(100 * value) / peak}%`,
                          minHeight: value ? 3 : 0,
                          backgroundColor: series[i].color,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                    ))}
                  </View>
                  <Sub numberOfLines={1} style={{ fontSize: 11, lineHeight: 16, color: active ? C.ink : CHART.muted, fontWeight: active ? '700' : '400' }}>
                    {buckets.length > 6 ? String(index + 1) : bucket.label}
                  </Sub>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

export type Segment = { label: string; value: number; color: string; icon: IconName };

/** شريط واحد مقسّم (مثل: بدون / جزئي / مكتمل) مع أرقام ونِسب تحته. */
export function StackedBar({ title, segments, testID }: { title: string; segments: Segment[]; testID?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <View testID={testID} style={{ marginBottom: 14 }}>
      <Spread style={{ marginBottom: 6 }}>
        <T style={{ fontWeight: '700' }}>{title}</T>
        <Sub>{total + ' فني'}</Sub>
      </Spread>
      <View style={{ flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden', backgroundColor: '#eeeaf6', gap: total ? 2 : 0 }}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <View key={segment.label} style={{ flex: segment.value, backgroundColor: segment.color }} />
          ))}
      </View>
      <Row gap={12} style={{ flexWrap: 'wrap', marginTop: 6 }}>
        {segments.map((segment) => (
          <Row key={segment.label} gap={4}>
            <Icon name={segment.icon} size={13} color={segment.color} />
            <T style={{ fontSize: 13 }}>
              {segment.label + ' ' + segment.value}
              <Sub style={{ fontSize: 12 }}>{total ? ' (' + Math.round((100 * segment.value) / total) + '%)' : ''}</Sub>
            </T>
          </Row>
        ))}
      </Row>
    </View>
  );
}

/** نسبة الإنجاز لكل قسم: شريط لكل قسم مع الرقم والنسبة. */
export function ProgressRows({ rows, color, testID }: { rows: { label: string; done: number; total: number }[]; color: string; testID?: string }) {
  return (
    <View testID={testID}>
      {rows.map((row) => {
        const pct = row.total ? Math.round((100 * row.done) / row.total) : 0;
        return (
          <View key={row.label} style={{ marginBottom: 10 }}>
            <Spread>
              <T style={{ fontSize: 14 }}>{row.label}</T>
              <T style={{ fontSize: 13, fontWeight: '700' }}>
                {pct + '%'}
                <Sub style={{ fontSize: 12 }}>{'  ⁦' + row.done + ' / ' + row.total + '⁩'}</Sub>
              </T>
            </Spread>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: '#eeeaf6', overflow: 'hidden', marginTop: 4 }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
