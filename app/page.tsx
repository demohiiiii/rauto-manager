"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Server,
  Network,
  Zap,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface DashboardData {
  stats: {
    activeAgents: number;
    totalAgents: number;
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    todayTasks: number;
    todaySuccess: number;
    todayFailed: number;
    systemHealth: number;
  };
  recentActivity: Array<{
    id: string;
    name: string;
    status: string;
    type: string;
    createdAt: string;
  }>;
  taskStats: {
    success: number;
    running: number;
    failed: number;
    total: number;
  };
  recentNotifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    level: string;
    createdAt: string;
  }>;
  topAgents: Array<{
    id: string;
    name: string;
    status: string;
    uptime: number;
  }>;
}

const STATUS_BADGE_KEYS: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; labelKey: string }> = {
  success: { variant: "default", labelKey: "success" },
  failed: { variant: "destructive", labelKey: "failed" },
  running: { variant: "secondary", labelKey: "running" },
  pending: { variant: "outline", labelKey: "pending" },
};

const DISPATCH_TYPE_KEYS: Record<string, string> = {
  exec: "commandExec",
  template: "templateExec",
  tx_block: "txBlock",
  tx_workflow: "txWorkflow",
  orchestrate: "multiDeviceOrchestrate",
};

function formatTime(
  date: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return t("timeJustNow");
  if (minutes < 60) return t("timeMinutesAgo", { count: minutes });
  if (hours < 24) return t("timeHoursAgo", { count: hours });
  return new Date(date).toLocaleDateString();
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(t("fetchDashboardFailed"));
      return res.json();
    },
    refetchInterval: 30000, // 每 30 秒刷新
  });

  const dashboardData = data?.data;

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

        {/* Stats Cards */}
        {isLoading ? (
          <StatsSkeleton />
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{tc("loadFailed", { message: (error as Error).message })}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-lift animate-fade-in stagger-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("activeAgents")}
                </CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.stats.activeAgents || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData?.stats.totalAgents ? (
                    <span className="text-green-600 dark:text-green-400 inline-flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {t("totalAgentsCount", { count: dashboardData.stats.totalAgents })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("noAgents")}</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-lift animate-fade-in stagger-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("managedDevices")}
                </CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.stats.totalDevices || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600 dark:text-green-400">
                    {t("onlineCount", { count: dashboardData?.stats.onlineDevices || 0 })}
                  </span>
                  {" / "}
                  <span className="text-red-600 dark:text-red-400">
                    {t("offlineCount", { count: dashboardData?.stats.offlineDevices || 0 })}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card className="hover-lift animate-fade-in stagger-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("todayTasks")}
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.stats.todayTasks || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600 dark:text-green-400">
                    {t("successCount", { count: dashboardData?.stats.todaySuccess || 0 })}
                  </span>
                  {" / "}
                  <span className="text-red-600 dark:text-red-400">
                    {t("failedCount", { count: dashboardData?.stats.todayFailed || 0 })}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card className="hover-lift animate-fade-in stagger-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("systemHealth")}
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.stats.systemHealth || 100}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={dashboardData?.stats.systemHealth && dashboardData.stats.systemHealth >= 80 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}>
                    {dashboardData?.stats.systemHealth && dashboardData.stats.systemHealth >= 80 ? t("systemRunningWell") : t("needsAttention")}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent Activity */}
          <Card className="col-span-4 animate-slide-in-left">
            <CardHeader>
              <CardTitle>{t("recentActivity")}</CardTitle>
              <CardDescription>
                {t("recentActivityDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : dashboardData?.recentActivity.length ? (
                <div className="space-y-4">
                  {dashboardData.recentActivity.map((activity) => {
                    const statusInfo = STATUS_BADGE_KEYS[activity.status] || STATUS_BADGE_KEYS.pending;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-300 hover-lift cursor-pointer"
                        onClick={() => router.push(`/tasks`)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Zap className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tc(DISPATCH_TYPE_KEYS[activity.type] || activity.type)} · {formatTime(activity.createdAt, tc)}
                          </p>
                        </div>
                        <Badge variant={statusInfo.variant}>{tc(statusInfo.labelKey)}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Server className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{t("waitingForFirstAgent")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("registerAgentFirst")}
                      </p>
                    </div>
                    <Badge variant="outline">{tc("pending")}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="col-span-3 animate-slide-in-right">
            <CardHeader>
              <CardTitle>{t("quickActions")}</CardTitle>
              <CardDescription>
                {t("quickActionsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start hover-scale transition-all"
                variant="outline"
                onClick={() => router.push("/agents")}
              >
                <Server className="mr-2 h-4 w-4" />
                {t("manageAgents")}
              </Button>
              <Button
                className="w-full justify-start hover-scale transition-all"
                variant="outline"
                onClick={() => router.push("/devices")}
              >
                <Network className="mr-2 h-4 w-4" />
                {t("manageDevices")}
              </Button>
              <Button
                className="w-full justify-start hover-scale transition-all"
                variant="outline"
                onClick={() => router.push("/tasks")}
              >
                <Zap className="mr-2 h-4 w-4" />
                {t("viewTasks")}
              </Button>
              <Button
                className="w-full justify-start hover-scale transition-all"
                variant="outline"
                onClick={() => router.push("/history")}
              >
                <Activity className="mr-2 h-4 w-4" />
                {t("viewHistory")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="animate-fade-in stagger-1">
            <CardHeader>
              <CardTitle>{t("taskExecutionStats")}</CardTitle>
              <CardDescription>
                {t("taskExecutionStatsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium">{tc("success")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{dashboardData?.taskStats.success || 0}</span>
                      <span className="text-xs text-muted-foreground">{tc("countUnit")}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-600 dark:bg-green-400 transition-all duration-500"
                      style={{
                        width: dashboardData?.taskStats.total
                          ? `${(dashboardData.taskStats.success / dashboardData.taskStats.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm font-medium">{t("inProgress")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{dashboardData?.taskStats.running || 0}</span>
                      <span className="text-xs text-muted-foreground">{tc("countUnit")}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-yellow-600 dark:bg-yellow-400 transition-all duration-500"
                      style={{
                        width: dashboardData?.taskStats.total
                          ? `${(dashboardData.taskStats.running / dashboardData.taskStats.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium">{tc("failed")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{dashboardData?.taskStats.failed || 0}</span>
                      <span className="text-xs text-muted-foreground">{tc("countUnit")}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-red-600 dark:bg-red-400 transition-all duration-500"
                      style={{
                        width: dashboardData?.taskStats.total
                          ? `${(dashboardData.taskStats.failed / dashboardData.taskStats.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("systemNotifications")}</CardTitle>
              <CardDescription>
                {t("systemNotificationsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-3 p-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : dashboardData?.recentNotifications.length ? (
                <div className="space-y-3">
                  {dashboardData.recentNotifications.map((notif) => {
                    const levelColors = {
                      info: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                      success: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
                      warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                      error: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
                    };
                    const colorClass = levelColors[notif.level as keyof typeof levelColors] || levelColors.info;

                    return (
                      <div key={notif.id} className={`flex gap-3 p-3 rounded-lg border ${colorClass}`}>
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("welcomeTitle")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("welcomeMessage")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
