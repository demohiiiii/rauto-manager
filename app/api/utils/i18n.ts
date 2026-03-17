import { prisma } from "@/lib/prisma";
import zhMessages from "@/messages/zh.json";
import enMessages from "@/messages/en.json";

type Messages = typeof zhMessages;
type Locale = "zh" | "en";

/**
 * 获取系统当前语言设置（从数据库读取）
 * 注意：为了保证语言切换的实时性，这里不使用缓存
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
 * 获取翻译函数
 * @param locale 语言代码
 * @returns 翻译函数 t(key, params)
 */
export function getTranslator(locale: Locale) {
  const messages: Messages = locale === "en" ? enMessages : zhMessages;

  return function t(
    key: string,
    params?: Record<string, string | number | Date>
  ): string {
    // 支持嵌套 key: "notifications.taskSuccess"
    const keys = key.split(".");
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key; // fallback to key itself
      }
    }

    // 参数替换: "Task {name} completed" + {name: "test"} → "Task test completed"
    if (typeof value === "string" && params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        const paramValue = params[paramKey];
        if (paramValue === undefined) {
          console.warn(`Translation parameter not found: ${paramKey} in key ${key}`);
          return `{${paramKey}}`;
        }
        // 处理 Date 类型
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
 * 便捷函数：获取当前系统语言的翻译函数
 */
export async function getSystemTranslator() {
  const locale = await getSystemLocale();
  return getTranslator(locale);
}
