"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Palette, Moon, Sun, Laptop, Check, Languages } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { COLOR_THEMES, THEME_MODES } from "../api";
import { LOCALES, LOCALE_LABELS } from "@/lib/locale";
import type { Locale } from "@/lib/locale";
import { toast } from "sonner";

const THEME_ICONS = { Sun, Moon, Laptop } as const;

export function AppearanceCard() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const currentLocale = useLocale() as Locale;
  const [colorTheme, setColorTheme] = useState("zinc");
  const [mounted, setMounted] = useState(false);

  // Read saved color theme on mount (useEffect, not useState side-effect)
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("color-theme") || "zinc";
    setColorTheme(saved);
  }, []);

  const applyColorTheme = (themeName: string) => {
    document.documentElement.setAttribute("data-color-theme", themeName);
    localStorage.setItem("color-theme", themeName);
    setColorTheme(themeName);
  };

  const changeLanguage = async (locale: Locale) => {
    try {
      const response = await fetch("/api/settings/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      if (!response.ok) {
        throw new Error("Failed to update language");
      }

      // 添加时间戳参数强制绕过缓存，然后硬刷新
      const url = new URL(window.location.href);
      url.searchParams.set("_t", Date.now().toString());
      window.location.href = url.toString();
    } catch (error) {
      toast.error(t("updateSettingsFailed"));
      console.error("Language change error:", error);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Card className="animate-fade-in stagger-4">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("appearance")}</CardTitle>
            <CardDescription>{t("appearanceDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme mode */}
        <div className="space-y-3">
          <p className="text-sm font-medium">{t("themeMode")}</p>
          <div
            className="grid grid-cols-3 gap-3"
            role="radiogroup"
            aria-label={t("selectThemeMode")}
          >
            {THEME_MODES.map((mode) => {
              const Icon = THEME_ICONS[mode.icon];
              const active = theme === mode.name;
              return (
                <button
                  key={mode.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(mode.labelKey)}
                  onClick={() => setTheme(mode.name)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {t(mode.labelKey)}
                  </span>
                  {active && <Check className="h-3 w-3 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Color scheme */}
        <div className="space-y-3">
          <p className="text-sm font-medium">{t("colorScheme")}</p>
          <div
            className="grid grid-cols-3 sm:grid-cols-6 gap-3"
            role="radiogroup"
            aria-label={t("selectColorScheme")}
          >
            {COLOR_THEMES.map((ct) => {
              const active = colorTheme === ct.name;
              return (
                <button
                  key={ct.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(ct.labelKey)}
                  onClick={() => applyColorTheme(ct.name)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all cursor-pointer ${
                    active
                      ? "bg-accent ring-2 ring-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full shadow-md relative"
                    style={{ backgroundColor: ct.color }}
                  >
                    {active && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{t(ct.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Language */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t("language")}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("languageDescription")}
          </p>
          <div
            className="grid grid-cols-2 gap-3"
            role="radiogroup"
            aria-label={t("language")}
          >
            {LOCALES.map((locale) => {
              const active = currentLocale === locale;
              return (
                <button
                  key={locale}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={LOCALE_LABELS[locale].nativeName}
                  onClick={() => changeLanguage(locale)}
                  className={`flex items-center justify-between rounded-lg border p-4 transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {LOCALE_LABELS[locale].nativeName}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground italic">
            {t("languageReloadNotice")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
