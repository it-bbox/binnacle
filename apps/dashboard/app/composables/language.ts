import { en as uiEnglish, ru as uiRussian } from '@nuxt/ui/locale';
import { DICTIONARIES, formatNumber, plural, secondsAgo, startingLanguage, type Forms, type Language } from '~/i18n';

const LANGUAGE_KEY = 'binnacle.language';

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

/** The page's language: the stored choice, or the browser's; the sidebar's switch changes and stores it. */
export function useLanguage() {
  const language = useState<Language>('language', () => startingLanguage(storedLanguage(), navigator.languages ?? [navigator.language]));
  const choose = (value: Language): void => {
    language.value = value;
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      // Storage refused: the choice holds until the page is reloaded.
    }
  };
  return {
    language,
    choose,
    t: computed(() => DICTIONARIES[language.value]),
    /** Nuxt UI's own strings, in the same language. */
    uiLocale: computed(() => (language.value === 'ru' ? uiRussian : uiEnglish)),
    plural: (count: number, forms: Forms): string => plural(language.value, count, forms),
    number: (value: number): string => formatNumber(language.value, value),
    secondsAgo: (seconds: number): string => secondsAgo(language.value, seconds),
    /** How long ago an ISO timestamp from the daemon was. */
    since: (timestamp: string): string => secondsAgo(language.value, (Date.now() - Date.parse(timestamp)) / 1000),
    /** An ISO timestamp from the daemon as a date and time. */
    dateTime: (timestamp: string): string => new Date(timestamp).toLocaleString(language.value, { dateStyle: 'medium', timeStyle: 'short' }),
  };
}
