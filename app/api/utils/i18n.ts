import { prisma } from "@/lib/prisma";
import zhMessages from "@/messages/zh.json";
import enMessages from "@/messages/en.json";

type Messages = typeof zhMessages;
type Locale = "zh" | "en";

/**
 * Read the current system locale from the database.
 * Caching is intentionally avoided so locale changes take effect immediately.
 */
export async function getSystemLocale(): Promise<Locale> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "system.locale" },
    });

    return (config?.value as Locale) ?? "en";
  } catch (error) {
    console.error("Failed to load locale from database:", error);
    return "en";
  }
}

/**
 * Build a translator function.
 * @param locale Locale code
 * @returns Translator function `t(key, params)`
 */
export function getTranslator(locale: Locale) {
  const messages: Messages = locale === "en" ? enMessages : zhMessages;

  return function t(
    key: string,
    params?: Record<string, string | number | Date>
  ): string {
    // Support nested keys such as "notifications.taskSuccess"
    const keys = key.split(".");
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key; // fallback to key itself
      }
    }

    // Replace placeholders: "Task {name} completed" + {name: "test"} => "Task test completed"
    if (typeof value === "string" && params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        const paramValue = params[paramKey];
        if (paramValue === undefined) {
          console.warn(`Translation parameter not found: ${paramKey} in key ${key}`);
          return `{${paramKey}}`;
        }
        // Handle Date instances explicitly
        if (paramValue instanceof Date) {
          return paramValue.toLocaleString();
        }
        return String(paramValue);
      });
    }

    return String(value);
  };
}

/**
 * Convenience helper that returns the translator for the active system locale.
 */
export async function getSystemTranslator() {
  const locale = await getSystemLocale();
  return getTranslator(locale);
}
