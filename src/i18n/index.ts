import { es } from "./locales/es";
import { en } from "./locales/en";
import { pt } from "./locales/pt";

export type Locale = "en" | "es" | "pt";
export type { TranslationKey } from "./locales/es";

import type { TranslationKey } from "./locales/es";

const STORAGE_KEY = "pengu-rush:locale";

type Dict = Record<TranslationKey, string>;
const LOCALES: Record<Locale, Dict> = { en, es, pt };

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && saved in LOCALES) return saved;
  const lang = (navigator.language || "").toLowerCase();
  if (lang.startsWith("pt")) return "pt";
  if (lang.startsWith("es")) return "es";
  return "en";
}

class I18nServiceClass {
  private locale: Locale;
  private dict: Dict;

  constructor() {
    this.locale = detectLocale();
    this.dict = LOCALES[this.locale];
    (window as any).__penguLocale__ = this.locale;
  }

  getLocale(): Locale { return this.locale; }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.dict = LOCALES[locale];
    localStorage.setItem(STORAGE_KEY, locale);
    (window as any).__penguLocale__ = locale;
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let str: string = this.dict[key] ?? en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  }
}

export const I18nService = new I18nServiceClass();

/** Shorthand — idéntico a `I18nService.t(key, params)`. */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return I18nService.t(key, params);
}
