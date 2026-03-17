"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw } from "lucide-react";
import { fetchSettings, updateConfigs } from "./api";
import type { SettingsData } from "./api";
import { UserProfileCard } from "./components/user-profile-card";
import { AgentConfigCard } from "./components/agent-config-card";
import { NotificationCard } from "./components/notification-card";
import { AppearanceCard } from "./components/appearance-card";
import { DataManagementCard } from "./components/data-management-card";
import { DangerZoneCard } from "./components/danger-zone-card";
import { useTranslations } from "next-intl";

// ─── Loading skeleton ───────────────────────────────────────────────────
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }, (_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [agentSaveSuccess, setAgentSaveSuccess] = useState(false);
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  // Mutation: batch update configs with optimistic update
  const configMutation = useMutation({
    mutationFn: updateConfigs,
    onMutate: async (newConfigs) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["settings"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<SettingsData>(["settings"]);

      // Optimistically update the cache
      if (previous) {
        queryClient.setQueryData<SettingsData>(["settings"], {
          ...previous,
          configs: { ...previous.configs, ...newConfigs },
        });
      }

      return { previous };
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      setAgentSaveSuccess(true);
      // Reset flag after a tick so AgentConfigCard can react
      setTimeout(() => setAgentSaveSuccess(false), 0);
    },
    onError: (err: Error, _variables, context) => {
      toast.error(err.message);
      // Roll back optimistic update on error
      if (context?.previous) {
        queryClient.setQueryData(["settings"], context.previous);
      }
    },
    onSettled: () => {
      // Refetch to ensure server state is in sync
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // Toggle a single notification config
  const handleNotificationToggle = useCallback(
    (key: string, enabled: boolean) => {
      configMutation.mutate({ [key]: String(enabled) });
    },
    [configMutation]
  );

  // Batch save agent/system configs
  const handleAgentSave = useCallback(
    (updates: Record<string, string>) => {
      configMutation.mutate(updates);
    },
    [configMutation]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>

        {isLoading ? (
          <SettingsSkeleton />
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6 flex items-center justify-between">
              <p className="text-destructive">
                {tc("loadFailed", { message: error.message })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {tc("retry")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <UserProfileCard admin={data?.admin ?? null} />

            <AgentConfigCard
              configs={data?.configs ?? {}}
              onSave={handleAgentSave}
              isSaving={configMutation.isPending}
              onSaveSuccess={agentSaveSuccess}
            />

            <NotificationCard
              configs={data?.configs ?? {}}
              onToggle={handleNotificationToggle}
            />

            <AppearanceCard />

            <DataManagementCard stats={data!.stats} />

            <DangerZoneCard />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
