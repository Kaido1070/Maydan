import React, { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { addMeeting } from '../domain/records';
import { suggestTalks, talkText } from '../domain/talks';
import { useApply, useStore } from '../store';
import { Button, C, Chip, Icon, KIND, Row, Sheet, Spread, Sub, T } from './kit';
import { useUi } from './ui';

/** اقتراح موضوع اجتماع سلامة قصير: نقاط مختصرة، واعتماده كعنوان اجتماع، أو مشاركته في القروبات. */
export function TalkCard({ onAdopt }: { onAdopt: (meetingId: string) => void }) {
  const { ws, now } = useStore();
  const apply = useApply();
  const ui = useUi();
  const suggestions = suggestTalks(ws, now.date);
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState(false);
  const current = suggestions[index % suggestions.length];
  const year = Number(now.date.slice(0, 4));

  const adopt = (title: string) => {
    let id = ws.meetings.find((m) => m.year === year && m.title === title)?.id ?? '';
    if (!id) {
      const error = apply((c) => {
        const result = addMeeting(c, title, year);
        id = result.meeting.id;
        return result.ws;
      });
      if (error) return ui.notify(error);
    }
    setAll(false);
    onAdopt(id);
    ui.notify('تم اختيار «' + title + '» كاجتماع. حدد الحاضرين');
  };

  const share = async (text: string) => {
    try {
      if (Platform.OS === 'web' && !(navigator as Navigator & { share?: unknown }).share) {
        await navigator.clipboard.writeText(text);
        ui.notify('انسخ النص، الصقه في القروب');
        return;
      }
      await Share.share({ message: text });
    } catch {
      ui.notify('تعذرت المشاركة');
    }
  };

  const body = (suggestion: typeof current, compact = false) => (
    <View>
      <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 6 }}>
        {suggestion.used ? <Chip tone="neutral" label="انقال هالسنة" /> : null}
        {suggestion.reasons.map((reason) => (
          <Chip key={reason} tone={reason.startsWith('مرتبط') ? 'amber' : 'meeting'} label={reason} />
        ))}
      </Row>
      {suggestion.talk.points.map((point) => (
        <Row key={point} gap={6} style={{ alignItems: 'flex-start', marginTop: 3 }}>
          <T style={{ color: KIND.meeting.solid, lineHeight: 22 }}>•</T>
          <T style={{ flex: 1, fontSize: compact ? 14 : 15, lineHeight: 22 }}>{point}</T>
        </Row>
      ))}
      <View style={{ backgroundColor: KIND.meeting.bg, borderRadius: 10, padding: 8, marginTop: 8 }}>
        <T style={{ fontSize: 14, color: KIND.meeting.fg }}>{'سؤال للفريق: ' + suggestion.talk.question}</T>
      </View>
    </View>
  );

  return (
    <View testID="talk-card" style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: KIND.meeting.solid, padding: 14, marginBottom: 12 }}>
      <Spread>
        <View style={{ flex: 1 }}>
          <Sub>موضوع مقترح للاجتماع</Sub>
          <T testID="talk-title" style={{ fontWeight: '700', fontSize: 18 }}>{current.talk.title}</T>
        </View>
        <Icon name="message-square" size={22} color={KIND.meeting.solid} />
      </Spread>
      <View style={{ marginTop: 6 }}>{body(current)}</View>
      <Row style={{ marginTop: 12 }}>
        <Button testID="talk-adopt" style={{ flex: 1, backgroundColor: KIND.meeting.solid }} small icon="check" label="اعتمده اجتماع" onPress={() => adopt(current.talk.title)} />
        <Button testID="talk-share" small variant="secondary" icon="share-2" label="شارك" onPress={() => share(talkText(current.talk))} />
      </Row>
      <Row style={{ marginTop: 8 }}>
        <Button testID="talk-next" style={{ flex: 1 }} small variant="ghost" icon="refresh-cw" label="اقتراح ثاني" onPress={() => setIndex(index + 1)} />
        <Button style={{ flex: 1 }} small variant="ghost" icon="list" label={'كل المواضيع · ' + suggestions.length} onPress={() => setAll(true)} />
      </Row>

      {all ? (
        <Sheet visible onClose={() => setAll(false)} title="مواضيع اجتماعات السلامة" sub="نقاط مختصرة توصل الرسالة للكل. راجعها مع تعليمات السلامة عندكم.">
          {suggestions.map((suggestion) => (
            <View key={suggestion.talk.id} style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
              <T style={{ fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{suggestion.talk.title}</T>
              {body(suggestion, true)}
              <Row style={{ marginTop: 10 }}>
                <Button style={{ flex: 1 }} small variant="secondary" label="اعتمده" onPress={() => adopt(suggestion.talk.title)} />
                <Button style={{ flex: 1 }} small variant="secondary" icon="share-2" label="شارك" onPress={() => share(talkText(suggestion.talk))} />
              </Row>
            </View>
          ))}
        </Sheet>
      ) : null}
    </View>
  );
}
