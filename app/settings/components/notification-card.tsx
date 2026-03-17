"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { NOTIFICATION_ITEMS } from "../api";

export function NotificationCard({
  configs,
  onToggle,
}: {
  configs: Record<string, string>;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  const t = useTranslations("settings");

  return (
    <Card className="animate-fade-in stagger-3">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("notificationPreferences")}</CardTitle>
            <CardDescription>{t("notificationPreferencesDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {NOTIFICATION_ITEMS.map((item, index) => {
          const enabled = configs[item.key] !== "false";
          const switchId = `switch-${item.key}`;
          return (
            <div key={item.key}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between py-2">
                <label htmlFor={switchId} className="space-y-0.5 cursor-pointer flex-1">
                  <p className="text-sm font-medium">{t(item.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(item.descriptionKey)}
                  </p>
                </label>
                <Switch
                  id={switchId}
                  checked={enabled}
                  onCheckedChange={(checked) => onToggle(item.key, checked)}
                  aria-label={t(item.labelKey)}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
