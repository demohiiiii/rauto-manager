export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "locale";

export const LOCALE_LABELS: Record<Locale, { nativeName: string }> = {
  en: { nativeName: "English" },
  zh: { nativeName: "中文" },
};

export function isValidLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}
