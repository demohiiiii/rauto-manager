"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { Agent, AgentLiveInfo } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Clock,
  HardDrive,
  Network,
  Server,
  Timer,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatAgentReportMode } from "@/lib/utils";

const STATUS_CONFIG = {
  online: {
    icon: Wifi,
    className: "bg-green-600 text-white",
    labelKey: "statusOnline",
  },
  busy: {
    icon: Activity,
    className: "bg-blue-600 text-white",
    labelKey: "statusBusy",
  },
  offline: {
    icon: WifiOff,
    className: "bg-slate-500 text-white",
    labelKey: "statusOffline",
  },
  error: {
    icon: AlertTriangle,
    className: "bg-red-600 text-white",
    labelKey: "statusError",
  },
} as const;

function formatUptime(seconds: number | bigint): string {
  const totalSeconds = Number(seconds);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0s";
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <div className="font-medium text-right">{children}</div>
    </div>
  );
}

interface AgentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
}

export function AgentDetailDialog({
  open,
  onOpenChange,
  agent,
}: AgentDetailDialogProps) {
  const t = useTranslations("agents");
  const td = useTranslations("dialogs");
  const tc = useTranslations("common");

  const { data, isLoading } = useQuery({
    queryKey: ["agent-devices", agent?.id],
    queryFn: () => apiClient.getDevicesByAgent(agent!.id),
    enabled: open && Boolean(agent?.id),
  });
  const { data: liveInfoResponse } = useQuery({
    queryKey: ["agent-info", agent?.id, agent?.reportMode],
    queryFn: () => apiClient.getAgentInfo(agent!.id),
    enabled: open && Boolean(agent?.id),
    retry: false,
  });

  if (!agent) {
    return null;
  }

  const liveInfo: AgentLiveInfo | undefined = liveInfoResponse?.success
    ? liveInfoResponse.data
    : undefined;

  const statusConfig = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
  const StatusIcon = statusConfig.icon;
  const devices = data?.data ?? [];
  const reachableDevices = devices.filter(
    (device) => device.status === "reachable"
  ).length;
  const unreachableDevices = devices.filter(
    (device) => device.status === "unreachable"
  ).length;
  const displayVersion = liveInfo?.version ?? agent.version;
  const displayUptimeSeconds = liveInfo?.uptimeSeconds ?? Number(agent.uptimeSeconds);
  const displayConnectionsCount =
    liveInfo?.connectionsCount ?? agent.connectionsCount;
  const displayTemplatesCount =
    liveInfo?.templatesCount ?? agent.templatesCount;
  const displayCapabilities = liveInfo?.capabilities ?? agent.capabilities;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Server className="h-5 w-5 shrink-0" />
            <span className="truncate">{td("agentDetailTitle")}</span>
          </DialogTitle>
          <DialogDescription>
            {td("agentDetailDescription", { name: agent.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <InfoRow label={tc("status")}>
              <Badge className={statusConfig.className}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {t(statusConfig.labelKey)}
              </Badge>
            </InfoRow>
            <InfoRow label={td("agentDetailAddress")}>
              <span className="font-mono text-xs">
                {agent.host}:{agent.port}
              </span>
            </InfoRow>
            <InfoRow label={t("connectionMethod")}>
              <Badge
                variant="outline"
                className={
                  formatAgentReportMode(agent.reportMode) === "gRPC"
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }
              >
                {formatAgentReportMode(agent.reportMode)}
              </Badge>
            </InfoRow>
            <InfoRow label={tc("version")}>
              {displayVersion ?? tc("notSet")}
            </InfoRow>
            <InfoRow label={td("agentDetailLastHeartbeat")}>
              {new Date(agent.lastHeartbeat).toLocaleString()}
            </InfoRow>
            <InfoRow label={td("agentDetailUptime")}>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {formatUptime(displayUptimeSeconds)}
              </span>
            </InfoRow>
            <InfoRow label={td("agentDetailManagedMode")}>
              {liveInfo
                ? liveInfo.managed
                  ? td("agentDetailManagedModeYes")
                  : td("agentDetailManagedModeNo")
                : tc("notSet")}
            </InfoRow>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">{td("agentDetailRuntime")}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  {td("agentDetailActiveSessions")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {agent.activeSessions}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  {td("agentDetailRunningTasks")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {agent.runningTasksCount}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  {td("agentDetailConnections")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {displayConnectionsCount}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  {td("agentDetailTemplates")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {displayTemplatesCount}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  {td("agentDetailCustomProfiles")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {liveInfo?.customProfilesCount ?? tc("notSet")}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">{tc("capabilities")}</h4>
            {displayCapabilities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {displayCapabilities.map((capability) => (
                  <Badge key={capability} variant="outline">
                    {capability}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tc("none")}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{td("agentDetailDevices")}</h4>
              <span className="text-xs text-muted-foreground">
                {td("agentDetailDevicesCount", { count: devices.length })}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {td("agentDetailNoDevices")}
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      {td("agentDetailTotalDevices")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {devices.length}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      {td("agentDetailReachableDevices")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
                      {reachableDevices}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      {td("agentDetailUnreachableDevices")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
                      {unreachableDevices}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {devices.slice(0, 8).map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{device.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {device.host}
                          {device.port ? `:${device.port}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{device.type}</Badge>
                        <Badge
                          variant={
                            device.status === "reachable"
                              ? "default"
                              : device.status === "unknown"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {device.status === "reachable"
                            ? tc("online")
                            : device.status === "unknown"
                              ? tc("unknown")
                              : tc("offline")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {devices.length > 8 && (
                    <p className="text-xs text-muted-foreground">
                      {td("agentDetailMoreDevices", { count: devices.length - 8 })}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
