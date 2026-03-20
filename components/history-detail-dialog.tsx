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
import { OutputBlock } from "@/components/task-result/shared";
import { ResultRenderer } from "@/components/task-result/result-renderer";
import {
  CheckCircle2,
  Clock,
  FileText,
  Network,
  Server,
  Terminal,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { DispatchType, ExecutionHistoryRecord } from "@/lib/types";

const STATUS_CONFIG = {
  success: {
    className: "bg-green-600 text-white",
    icon: CheckCircle2,
    labelKey: "success",
  },
  failed: {
    className: "bg-red-600 text-white",
    icon: XCircle,
    labelKey: "failed",
  },
} as const;

const DISPATCH_TYPE_CONFIG: Record<
  DispatchType,
  { icon: typeof Terminal; labelKey: string }
> = {
  exec: { icon: Terminal, labelKey: "commandExec" },
  template: { icon: FileText, labelKey: "templateExec" },
  tx_block: { icon: FileText, labelKey: "txBlock" },
  tx_workflow: { icon: FileText, labelKey: "txWorkflow" },
  orchestrate: { icon: Network, labelKey: "multiDeviceOrchestrate" },
};

function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function formatOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }

  return JSON.stringify(output, null, 2);
}

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

interface HistoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ExecutionHistoryRecord | null;
}

export function HistoryDetailDialog({
  open,
  onOpenChange,
  record,
}: HistoryDetailDialogProps) {
  const t = useTranslations("history");
  const tc = useTranslations("common");

  if (!record) return null;

  const statusConfig = STATUS_CONFIG[record.status];
  const StatusIcon = statusConfig.icon;
  const parsedOutput = record.output ? parseOutput(record.output) : null;
  const hasStructuredOutput =
    parsedOutput !== null && typeof parsedOutput === "object";
  const dispatchType =
    record.task?.dispatchType && DISPATCH_TYPE_CONFIG[record.task.dispatchType]
      ? DISPATCH_TYPE_CONFIG[record.task.dispatchType]
      : null;
  const DispatchIcon = dispatchType?.icon ?? Terminal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Clock className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("recordDetails")}</span>
          </DialogTitle>
          <DialogDescription>{t("recordDetailsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <InfoRow label={tc("status")}>
              <Badge className={statusConfig.className}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {tc(statusConfig.labelKey)}
              </Badge>
            </InfoRow>
            <InfoRow label={t("executedAt")}>
              {new Date(record.createdAt).toLocaleString()}
            </InfoRow>
            <InfoRow label={t("executionDuration")}>
              {record.executionTime}ms
            </InfoRow>
            <InfoRow label={t("relatedTask")}>
              {record.task?.name ?? tc("unknown")}
            </InfoRow>
            <InfoRow label={t("executionAgent")}>
              <span className="inline-flex items-center gap-1">
                <Server className="h-3 w-3" />
                {record.agent?.name ?? tc("unknown")}
              </span>
            </InfoRow>
            <InfoRow label={t("targetDevice")}>
              {record.device ? (
                <span className="inline-flex flex-col items-end">
                  <span>{record.device.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {record.device.host}
                  </span>
                </span>
              ) : (
                tc("notSet")
              )}
            </InfoRow>
            {dispatchType && (
              <InfoRow label={t("dispatchType")}>
                <Badge variant="outline" className="gap-1">
                  <DispatchIcon className="h-3 w-3" />
                  {tc(dispatchType.labelKey)}
                </Badge>
              </InfoRow>
            )}
            <InfoRow label={tc("command")}>
              <code className="text-xs font-mono">{record.command}</code>
            </InfoRow>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("structuredResult")}</h4>
            {record.output ? (
              record.task?.dispatchType && hasStructuredOutput ? (
                <ResultRenderer
                  dispatchType={record.task.dispatchType}
                  result={parsedOutput}
                />
              ) : (
                <OutputBlock
                  content={formatOutput(parsedOutput)}
                  maxHeight="420px"
                  isError={record.status === "failed"}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("outputUnavailable")}
              </p>
            )}
          </div>

          {record.output && hasStructuredOutput && (
            <details className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("rawPayload")}
              </summary>
              <div className="mt-3">
                <OutputBlock
                  content={formatOutput(parsedOutput)}
                  maxHeight="320px"
                  isError={record.status === "failed"}
                />
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
