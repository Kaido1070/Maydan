import { registerRootComponent } from 'expo';
import { I18nManager, Platform } from 'react-native';

import App from './App';

// التطبيق عربي بالكامل: نفعّل اتجاه اليمين لليسار.
// على iOS/Android يُضبط أيضًا عبر إعداد expo-localization في app.json (forcesRTL).
if (Platform.OS === 'web') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
} else if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

registerRootComponent(App);
