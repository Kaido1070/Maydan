import { formatCoords, isMapsLink, mapsLink, parseCoords } from '../geo';

describe('موقع الزيارة من خرائط قوقل', () => {
  test('يقرأ الإحداثيات من النص ومن روابط قوقل', () => {
    const riyadh = { lat: 24.7136, lng: 46.6753 };
    expect(parseCoords('24.7136, 46.6753')).toEqual(riyadh);
    expect(parseCoords('٢٤.٧١٣٦، ٤٦.٦٧٥٣')).toEqual(riyadh);
    expect(parseCoords('https://www.google.com/maps/@24.7136,46.6753,17z')).toEqual(riyadh);
    expect(parseCoords('https://www.google.com/maps/search/?api=1&query=24.7136,46.6753')).toEqual(riyadh);
    expect(parseCoords('https://maps.google.com/?q=24.7136%2C46.6753')).toEqual(riyadh);
    // إحداثيات الدبوس (!3d!4d) أدق من مركز الخريطة (@)
    expect(parseCoords('https://www.google.com/maps/place/X/@24.70,46.60,15z/data=!3m1!4b1!4m6!3m5!8m2!3d24.7136!4d46.6753')).toEqual(riyadh);
  });

  test('النص العادي والروابط المختصرة والقيم الغلط ما تنحسب إحداثيات', () => {
    expect(parseCoords('حي الروضة، شارع 12')).toBeNull();
    expect(parseCoords('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(parseCoords('124.7136, 46.6753')).toBeNull();
    expect(isMapsLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true);
    expect(isMapsLink('حي الروضة')).toBe(false);
  });

  test('رابط الفتح في خرائط قوقل', () => {
    expect(mapsLink({ lat: 24.71360004, lng: 46.6753 })).toBe('https://www.google.com/maps/search/?api=1&query=24.7136,46.6753');
    expect(formatCoords({ lat: 24.7136, lng: 46.6753 })).toBe('24.7136, 46.6753');
  });
});
