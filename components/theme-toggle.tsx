"use client";

import * as React from "react";
import { Moon, Sun, Laptop, Palette, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");
  const [colorTheme, setColorTheme] = React.useState("zinc");
  const [mounted, setMounted] = React.useState(false);

  const themes = [
    { name: "light", label: t("lightMode"), icon: Sun },
    { name: "dark", label: t("darkMode"), icon: Moon },
    { name: "system", label: t("systemMode"), icon: Laptop },
  ];

  const colorThemes = [
    { name: "zinc", label: t("colorZinc"), color: "#71717a" },
    { name: "blue", label: t("colorBlue"), color: "#3b82f6" },
    { name: "green", label: t("colorGreen"), color: "#22c55e" },
    { name: "purple", label: t("colorPurple"), color: "#a855f7" },
    { name: "orange", label: t("colorOrange"), color: "#f97316" },
    { name: "rose", label: t("colorRose"), color: "#f43f5e" },
  ];

  React.useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("color-theme") || "zinc";
    setColorTheme(savedColorTheme);
    applyColorTheme(savedColorTheme);
  }, []);

  const applyColorTheme = (themeName: string) => {
    const root = document.documentElement;
    root.setAttribute("data-color-theme", themeName);
    localStorage.setItem("color-theme", themeName);
    setColorTheme(themeName);
  };

  if (!mounted) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Palette className="h-5 w-5" />
          <span className="sr-only">{t("themeMode")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("themeMode")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.name}
              onClick={() => setTheme(item.name)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {theme === item.name && (
                <Check className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("colorScheme")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="grid grid-cols-3 gap-2 p-2">
          {colorThemes.map((item) => (
            <DropdownMenuItem
              key={item.name}
              asChild
              onSelect={(e) => {
                e.preventDefault();
                applyColorTheme(item.name);
              }}
            >
              <button
                className={`flex flex-col items-center gap-1.5 p-2 rounded-md cursor-pointer transition-colors ${
                  colorTheme === item.name
                    ? "bg-accent ring-2 ring-primary"
                    : "hover:bg-accent"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-md relative"
                  style={{ backgroundColor: item.color }}
                >
                  {colorTheme === item.name && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
