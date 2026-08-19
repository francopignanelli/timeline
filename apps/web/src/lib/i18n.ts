import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en';
import { es } from '../locales/es';

const STORAGE_KEY = 'timeline.locale';

function detectInitialLocale(): 'en' | 'es' {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const initialLocale = detectInitialLocale();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem(STORAGE_KEY, lng);
});
document.documentElement.lang = initialLocale;

export default i18n;
