import { normalizeDigits } from './dates';

/** إحداثيات موقع الزيارة. */
export type Coords = { lat: number; lng: number };

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const NUM = '(-?\\d{1,3}\\.\\d{3,})';

/**
 * يطلع الإحداثيات من نص أو رابط خرائط قوقل:
 * «24.7136, 46.6753»، أو رابط فيه ‎@lat,lng أو ‎q=lat,lng أو ‎!3dlat!4dlng.
 * الروابط المختصرة (maps.app.goo.gl) ما فيها إحداثيات، فترجع null.
 */
export function parseCoords(text: string): Coords | null {
  const value = normalizeDigits(text).trim();
  const patterns = [
    new RegExp('!3d' + NUM + '!4d' + NUM),
    new RegExp('[?&](?:q|query|ll|destination|center)=' + NUM + '(?:,|%2C)\\s*' + NUM),
    new RegExp('@' + NUM + ',' + NUM),
    new RegExp('^' + NUM + '\\s*[,،\\s]\\s*' + NUM + '$'),
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

export const isMapsLink = (text: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.)/i.test(text.trim());

const round = (value: number) => Math.round(value * 1e6) / 1e6;
export const formatCoords = (coords: Coords) => round(coords.lat) + ', ' + round(coords.lng);

/** رابط يفتح الموقع في خرائط قوقل (التطبيق إذا موجود، وإلا المتصفح). */
export const mapsLink = (coords: Coords) => 'https://www.google.com/maps/search/?api=1&query=' + round(coords.lat) + ',' + round(coords.lng);

/** خريطة قوقل مضمّنة للمعاينة داخل التطبيق. */
export const mapsEmbed = (coords: Coords) => 'https://maps.google.com/maps?q=' + round(coords.lat) + ',' + round(coords.lng) + '&z=17&hl=ar&output=embed';
