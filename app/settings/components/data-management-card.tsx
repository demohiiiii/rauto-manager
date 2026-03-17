"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Database, Trash2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { clearHistory, clearNotifications } from "../api";
import type { SettingsData } from "../api";

export function DataManagementCard({
  stats,
}: {
  stats: SettingsData["stats"];
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const clearHistoryMutation = useMutation({
    mutationFn: clearHistory,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearNotificationsMutation = useMutation({
    mutationFn: clearNotifications,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statItems = [
    { labelKey: "Agent", value: stats.agents },
    { labelKey: "statDevices", value: stats.devices },
    { labelKey: "statTasks", value: stats.tasks },
    { labelKey: "statHistory", value: stats.history },
    { labelKey: "statNotifications", value: stats.notifications },
  ];

  return (
    <Card className="animate-fade-in stagger-5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("dataManagement")}</CardTitle>
            <CardDescription>{t("dataManagementDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid - responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statItems.map((item) => (
            <div
              key={item.labelKey}
              className="text-center rounded-lg border p-3"
            >
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.labelKey === "Agent" ? "Agent" : t(item.labelKey)}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Clear history */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("clearHistory")}</p>
            <p className="text-xs text-muted-foreground">
              {t("clearHistoryDescription", { count: stats.history })}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!stats.history}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("clearButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmClearHistoryTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirmClearHistoryDescription", { count: stats.history })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearHistoryMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearHistoryMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("confirmClear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Separator />

        {/* Clear notifications */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("clearNotifications")}</p>
            <p className="text-xs text-muted-foreground">
              {t("clearNotificationsDescription", { count: stats.notifications })}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!stats.notifications}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("clearButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmClearNotificationsTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirmClearNotificationsDescription", { count: stats.notifications })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearNotificationsMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearNotificationsMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("confirmClear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
