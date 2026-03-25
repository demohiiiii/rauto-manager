"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode,
  GitBranch,
  Info,
  Layers,
  Loader2,
  Network,
  Play,
  Server,
  StopCircle,
  Terminal,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  DispatchType,
  ExecutionHistory,
  Task,
  TaskDetail,
  TaskExecutionEvent,
} from "@/lib/types";
import { PayloadRenderer } from "@/components/task-result/payload-renderer";
import { ResultRenderer } from "@/components/task-result/result-renderer";
import {
  parseRecordingJsonl,
  type RecordingEntry,
} from "@/components/task-result/command-echo-table";
import { OutputBlock } from "@/components/task-result/shared";
import { apiClient } from "@/lib/api/client";

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; className: string; icon: typeof Clock }
> = {
  pending: {
    labelKey: "pending",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  queued: {
    labelKey: "queued",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  running: {
    labelKey: "running",
    icon: Play,
    className: "bg-blue-600 text-white",
  },
  success: {
    labelKey: "success",
    icon: CheckCircle2,
    className: "bg-green-600 text-white",
  },
  failed: {
    labelKey: "failed",
    icon: XCircle,
    className: "bg-red-600 text-white",
  },
  cancelled: {
    labelKey: "cancel",
    icon: StopCircle,
    className: "bg-gray-500 text-white",
  },
};

const TYPE_LABELS: Record<
  DispatchType,
  { labelKey: string; icon: typeof Terminal }
> = {
  exec: { labelKey: "commandExec", icon: Terminal },
  template: { labelKey: "templateExec", icon: FileCode },
  tx_block: { labelKey: "txBlock", icon: Layers },
  tx_workflow: { labelKey: "workflow", icon: GitBranch },
  orchestrate: { labelKey: "multiDeviceOrchestrate", icon: Network },
};

type TaskDetailLike = Task & {
  executionHistory?: ExecutionHistory[];
  executionEvents?: TaskExecutionEvent[];
};

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDetailLike | null;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1 gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

function ExecutionHistoryTable({
  history,
  emptyText,
}: {
  history: ExecutionHistory[];
  emptyText?: string;
}) {
  const t = useTranslations("dialogs");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allEntries: Array<{
    id: string;
    entry: RecordingEntry;
    historyId: string;
    createdAt: Date;
  }> = [];

  history.forEach((h) => {
    try {
      const parsed = JSON.parse(h.output);
      collectRecordingJsonlStrings(parsed).forEach((recordingJsonl, recordingIndex) => {
        const entries = parseRecordingJsonl(recordingJsonl);
        entries.forEach((entry, idx) => {
          allEntries.push({
            id: `${h.id}-${recordingIndex}-${idx}`,
            entry,
            historyId: h.id,
            createdAt: h.createdAt,
          });
        });
      });
    } catch {
      // Ignore malformed recording payloads
    }
  });

  if (allEntries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {emptyText ?? t("taskDetailHistoryNoOutput")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 w-8">
              {t("taskDetailHistoryIndex")}
            </th>
            <th className="text-left px-3 py-2">
              {t("taskDetailHistoryCommand")}
            </th>
            <th className="text-left px-3 py-2 w-20">
              {t("taskDetailHistoryStatus")}
            </th>
            <th className="text-left px-3 py-2 w-24">Mode</th>
            <th className="text-left px-3 py-2 w-24">
              {t("taskDetailHistoryExitCode")}
            </th>
            <th className="text-right px-3 py-2 w-36">
              {t("taskDetailHistoryTime")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {allEntries.map((item, idx) => {
            const { entry } = item;
            const isFailed = entry.event.success === false;
            const isExpanded = expandedRows.has(item.id);
            const hasOutput = Boolean(entry.event.content || entry.event.all);

            return (
              <tr key={item.id} className="group">
                <td colSpan={6} className="p-0">
                  <div
                    className={`
                      flex items-center transition-colors
                      ${hasOutput ? "cursor-pointer" : ""}
                      ${
                        isFailed
                          ? "bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-l-4 border-rose-400"
                          : "hover:bg-muted/30"
                      }
                    `}
                    onClick={() => hasOutput && toggleRow(item.id)}
                  >
                    <span className="px-3 py-2 w-8 text-xs text-muted-foreground shrink-0">
                      {hasOutput ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="px-3 py-2 flex-1 min-w-0">
                      <code className="font-mono text-xs break-all">
                        {entry.event.command || "—"}
                      </code>
                    </span>
                    <span className="px-3 py-2 w-20 shrink-0">
                      <span
                        className={`
                          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium
                          ${
                            isFailed
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }
                        `}
                      >
                        {isFailed ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {isFailed
                          ? t("taskDetailHistoryFailed")
                          : t("taskDetailHistorySuccess")}
                      </span>
                    </span>
                    <span className="px-3 py-2 w-24 shrink-0">
                      {entry.event.mode && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {entry.event.mode}
                        </span>
                      )}
                    </span>
                    <span className="px-3 py-2 w-24 shrink-0 text-xs text-muted-foreground">
                      {typeof entry.event.exit_code === "number"
                        ? entry.event.exit_code
                        : "—"}
                    </span>
                    <span className="px-3 py-2 w-36 text-right text-xs text-muted-foreground shrink-0">
                      {new Date(entry.ts_ms).toLocaleString()}
                    </span>
                  </div>

                  {isExpanded && hasOutput && (
                    <div className="px-3 pb-3 pt-1 bg-muted/20">
                      <div className="text-xs text-muted-foreground mb-1 font-medium">
                        {t("taskDetailHistoryOutput")}
                      </div>
                      <OutputBlock
                        content={entry.event.content || entry.event.all || ""}
                        maxHeight="150px"
                        isError={isFailed}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getLatestEvent(events: TaskExecutionEvent[]): TaskExecutionEvent | null {
  return events.length > 0 ? events[events.length - 1] : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function containsRecordingJsonl(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (typeof value === "string") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsRecordingJsonl(item));
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return false;
  }

  const recordingJsonl = objectValue.recording_jsonl;
  if (typeof recordingJsonl === "string" && parseRecordingJsonl(recordingJsonl).length > 0) {
    return true;
  }

  return Object.values(objectValue).some((item) => containsRecordingJsonl(item));
}

function collectRecordingJsonlStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRecordingJsonlStrings(item));
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return [];
  }

  const results: string[] = [];
  if (typeof objectValue.recording_jsonl === "string") {
    results.push(objectValue.recording_jsonl);
  }

  for (const item of Object.values(objectValue)) {
    results.push(...collectRecordingJsonlStrings(item));
  }

  return results;
}

function hasHistoryCommandEchoes(history: ExecutionHistory[]): boolean {
  return history.some((record) => {
    try {
      const parsed = JSON.parse(record.output) as Record<string, unknown>;
      return collectRecordingJsonlStrings(parsed).some(
        (recordingJsonl) => parseRecordingJsonl(recordingJsonl).length > 0
      );
    } catch {
      return false;
    }
  });
}

function getConfiguredRecordLevel(
  task: TaskDetailLike
): "Off" | "KeyEventsOnly" | "Full" | null {
  const payload = asObject(task.payload);
  const value = payload?.record_level;
  if (value === "Off" || value === "KeyEventsOnly" || value === "Full") {
    return value;
  }
  return null;
}

function getLatestProgress(
  task: TaskDetailLike,
  events: TaskExecutionEvent[],
): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const progress = events[index].progress;
    if (typeof progress === "number") {
      return progress;
    }
  }

  if (task.status === "success") {
    return 100;
  }

  return null;
}

function TaskExecutionTimeline({ events }: { events: TaskExecutionEvent[] }) {
  const t = useTranslations("tasks");

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const config =
          event.level === "success"
            ? {
                icon: CheckCircle2,
                badgeClass: "bg-green-600 text-white",
                dotClass: "bg-green-500",
              }
            : event.level === "error"
              ? {
                  icon: XCircle,
                  badgeClass: "bg-red-600 text-white",
                  dotClass: "bg-red-500",
                }
              : event.level === "warning"
                ? {
                    icon: AlertTriangle,
                    badgeClass:
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                    dotClass: "bg-yellow-500",
                  }
                : event.eventType === "log"
                  ? {
                      icon: Terminal,
                      badgeClass:
                        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
                      dotClass: "bg-slate-500",
                    }
                  : {
                      icon: Info,
                      badgeClass:
                        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                      dotClass: "bg-blue-500",
                    };

        const Icon = config.icon;
        const reporter = event.agentName || t("reportedByManager");

        return (
          <div
            key={event.id}
            className="relative rounded-lg border bg-background px-4 py-3"
          >
            <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <span className={`h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
            </div>
            <div className="ml-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={config.badgeClass}>
                  <Icon className="mr-1 h-3 w-3" />
                  {event.eventType}
                </Badge>
                {event.stage && <Badge variant="outline">{event.stage}</Badge>}
                {typeof event.progress === "number" && (
                  <Badge variant="secondary">{event.progress}%</Badge>
                )}
              </div>
              <p className="text-sm font-medium">{event.message}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  {t("reportedBy")}: {reporter}
                </span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toFallbackTaskDetail(task: TaskDetailLike): TaskDetail {
  return {
    ...task,
    executionHistory: task.executionHistory ?? [],
    executionEvents: task.executionEvents ?? [],
  };
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
}: TaskDetailDialogProps) {
  const t = useTranslations("dialogs");
  const tt = useTranslations("tasks");
  const tc = useTranslations("common");

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["task", task?.id],
    queryFn: async () => {
      if (!task) {
        throw new Error("Missing task");
      }
      return apiClient.getTask(task.id);
    },
    enabled: open && Boolean(task?.id),
    refetchInterval: (query) => {
      const detail = query.state.data?.data;
      if (!detail) {
        return false;
      }

      return detail.status === "queued" || detail.status === "running"
        ? 2000
        : false;
    },
  });

  if (!task) return null;

  const detailTask = data?.data ?? toFallbackTaskDetail(task);
  const executionEvents = detailTask.executionEvents ?? [];
  const executionHistory = detailTask.executionHistory ?? [];
  const latestEvent = getLatestEvent(executionEvents);
  const currentProgress = getLatestProgress(detailTask, executionEvents);
  const configuredRecordLevel = getConfiguredRecordLevel(detailTask);
  const hasCommandEchoes =
    containsRecordingJsonl(detailTask.result) || hasHistoryCommandEchoes(executionHistory);
  const supportsCommandEchoHint = ["tx_block", "tx_workflow", "orchestrate"].includes(
    detailTask.dispatchType
  );
  const shouldShowCommandEchoHint =
    supportsCommandEchoHint &&
    ["success", "failed", "cancelled"].includes(detailTask.status) &&
    !hasCommandEchoes;
  const commandEchoHintTitle =
    configuredRecordLevel === "Off"
      ? t("taskDetailRecordingDisabledTitle")
      : configuredRecordLevel
        ? t("taskDetailRecordingUnavailableTitle")
        : t("taskDetailRecordingUnknownTitle");
  const commandEchoHintDescription =
    configuredRecordLevel === "Off"
      ? t("taskDetailRecordingDisabledDescription")
      : configuredRecordLevel
        ? t("taskDetailRecordingUnavailableDescription")
        : t("taskDetailRecordingUnknownDescription");
  const historyEmptyText =
    configuredRecordLevel === "Off"
      ? t("taskDetailHistoryRecordingDisabled")
      : configuredRecordLevel
        ? t("taskDetailHistoryRecordingUnavailable")
        : t("taskDetailHistoryNoOutput");

  const statusConfig =
    STATUS_CONFIG[detailTask.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const typeConfig = TYPE_LABELS[detailTask.dispatchType] ?? TYPE_LABELS.exec;
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <TypeIcon className="h-5 w-5 shrink-0" />
            <span className="truncate">{detailTask.name}</span>
          </DialogTitle>
          <DialogDescription>
            {detailTask.description || tc("noDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <InfoRow label={t("taskDetailStatus")}>
              <Badge className={statusConfig.className}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {tc(statusConfig.labelKey)}
              </Badge>
            </InfoRow>
            <InfoRow label={t("taskDetailDispatchType")}>
              <Badge variant="outline" className="gap-1">
                <TypeIcon className="h-3 w-3" />
                {tc(typeConfig.labelKey)}
              </Badge>
            </InfoRow>
            <InfoRow label={t("taskDetailAgentCount")}>
              {detailTask.agentIds.length}
            </InfoRow>
            <InfoRow label={t("taskDetailCreatedAt")}>
              {new Date(detailTask.createdAt).toLocaleString()}
            </InfoRow>
            {detailTask.startedAt && (
              <InfoRow label={t("taskDetailStartedAt")}>
                {new Date(detailTask.startedAt).toLocaleString()}
              </InfoRow>
            )}
            {detailTask.completedAt && (
              <InfoRow label={t("taskDetailCompletedAt")}>
                {new Date(detailTask.completedAt).toLocaleString()}
              </InfoRow>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("taskDetailPayload")}</h4>
            <PayloadRenderer
              dispatchType={detailTask.dispatchType}
              payload={detailTask.payload}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{tt("liveExecution")}</h4>
                <p className="text-sm text-muted-foreground">
                  {tt("liveExecutionDescription")}
                </p>
              </div>
              {(detailTask.status === "queued" || detailTask.status === "running") && (
                <Badge variant="secondary" className="gap-1">
                  {isFetching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  {tt("refreshingLiveState")}
                </Badge>
              )}
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {tt("liveStatus")}
                  </p>
                  <div className="mt-1">
                    <Badge className={statusConfig.className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {tc(statusConfig.labelKey)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {tt("progressLabel")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {currentProgress === null
                      ? tt("progressUnavailable")
                      : `${currentProgress}%`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      detailTask.status === "failed"
                        ? "bg-red-500"
                        : detailTask.status === "cancelled"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${currentProgress ?? 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{tt("latestEvent")}</span>
                  <span className="text-right font-medium">
                    {latestEvent?.message || tt("waitingForExecutionEvents")}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {tt("fetchTaskFailed", { message: String(error) })}
              </div>
            )}

            {isLoading && !data ? (
              <div className="rounded-lg border bg-background px-4 py-6 text-sm text-muted-foreground">
                {tc("loading")}
              </div>
            ) : executionEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                <p className="font-medium">{tt("waitingForExecutionEvents")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tt("waitingForExecutionEventsDescription")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">{tt("eventTimeline")}</h5>
                <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/10 p-3">
                  <TaskExecutionTimeline events={executionEvents} />
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("taskDetailResult")}</h4>
            <ResultRenderer
              dispatchType={detailTask.dispatchType}
              result={detailTask.result}
            />
            {shouldShowCommandEchoHint && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  {commandEchoHintTitle}
                </p>
                <p className="mt-1 text-amber-800/90 dark:text-amber-300">
                  {commandEchoHintDescription}
                </p>
              </div>
            )}
          </div>

          {executionHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("taskDetailHistory")}</h4>
                <ExecutionHistoryTable
                  history={executionHistory}
                  emptyText={historyEmptyText}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
