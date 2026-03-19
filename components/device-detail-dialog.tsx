"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HardDrive,
  HelpCircle,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Device } from "@/lib/types";
import { useTranslations } from "next-intl";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm py-1.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="text-right font-medium break-all">{children}</div>
    </div>
  );
}

function formatMetadata(metadata: Device["metadata"]): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  return JSON.stringify(metadata, null, 2);
}

interface DeviceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
}

export function DeviceDetailDialog({
  open,
  onOpenChange,
  device,
}: DeviceDetailDialogProps) {
  const t = useTranslations("devices");
  const td = useTranslations("dialogs");
  const tc = useTranslations("common");

  if (!device) {
    return null;
  }

  const statusConfig = {
    reachable: {
      icon: Wifi,
      className: "bg-green-600 text-white",
      label: t("statusReachable"),
    },
    unreachable: {
      icon: WifiOff,
      className: "bg-red-600 text-white",
      label: t("statusUnreachable"),
    },
    unknown: {
      icon: HelpCircle,
      className: "bg-slate-500 text-white",
      label: t("statusUnknown"),
    },
  }[device.status];

  const StatusIcon = statusConfig.icon;
  const metadataText = formatMetadata(device.metadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <HardDrive className="h-5 w-5 shrink-0" />
            <span className="truncate">{td("deviceDetailTitle")}</span>
          </DialogTitle>
          <DialogDescription>
            {td("deviceDetailDescription", { name: device.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <InfoRow label={tc("status")}>
              <div className="space-y-1">
                <Badge className={statusConfig.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {device.statusReason === "agent_offline" && (
                  <p className="text-xs text-muted-foreground">
                    {t("statusReasonAgentOffline")}
                  </p>
                )}
              </div>
            </InfoRow>
            <InfoRow label={t("deviceName")}>{device.name}</InfoRow>
            <InfoRow label={t("type")}>
              <Badge variant="outline">{device.type}</Badge>
            </InfoRow>
            <InfoRow label={t("address")}>
              <span className="font-mono text-xs">
                {device.host}
                {device.port ? `:${device.port}` : ""}
              </span>
            </InfoRow>
            <InfoRow label={t("belongsToAgent")}>
              {device.agent ? (
                <span className="inline-flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  {device.agent.name}
                </span>
              ) : (
                tc("unknown")
              )}
            </InfoRow>
            <InfoRow label={td("deviceDetailLastChecked")}>
              {device.lastChecked
                ? new Date(device.lastChecked).toLocaleString()
                : tc("notSet")}
            </InfoRow>
            <InfoRow label={td("deviceDetailCreatedAt")}>
              {new Date(device.createdAt).toLocaleString()}
            </InfoRow>
            <InfoRow label={td("deviceDetailUpdatedAt")}>
              {new Date(device.updatedAt).toLocaleString()}
            </InfoRow>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{td("deviceDetailMetadata")}</h4>
            {metadataText ? (
              <pre className="rounded-lg border bg-muted/20 p-3 text-xs overflow-x-auto">
                {metadataText}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                {td("deviceDetailNoMetadata")}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
