import { getRequestConfig } from "next-intl/server";
import { getSystemLocale } from "@/app/api/utils/i18n";

export default getRequestConfig(async () => {
  const locale = await getSystemLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
