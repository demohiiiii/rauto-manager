"use client";

import { useState } from "react";
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
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  StopCircle,
  Terminal,
  FileCode,
  Layers,
  GitBranch,
  Network,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Task, DispatchType, ExecutionHistory } from "@/lib/types";
import { PayloadRenderer } from "@/components/task-result/payload-renderer";
import { ResultRenderer } from "@/components/task-result/result-renderer";
import { OutputBlock } from "@/components/task-result/shared";

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; className: string; icon: typeof Clock }
> = {
  pending: {
    labelKey: "pending",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
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

const TYPE_LABELS: Record<DispatchType, { labelKey: string; icon: typeof Terminal }> = {
  exec: { labelKey: "commandExec", icon: Terminal },
  template: { labelKey: "templateExec", icon: FileCode },
  tx_block: { labelKey: "txBlock", icon: Layers },
  tx_workflow: { labelKey: "workflow", icon: GitBranch },
  orchestrate: { labelKey: "multiDeviceOrchestrate", icon: Network },
};

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: (Task & { executionHistory?: ExecutionHistory[] }) | null;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

// 解析 recording JSONL 中的命令执行记录
interface RecordingEntry {
  ts_ms: number;
  event: {
    kind: string;
    command?: string;
    mode?: string;
    success?: boolean;
    content?: string;
    all?: string;
    prompt_before?: string;
    prompt_after?: string;
  };
}

function parseRecordingJsonl(jsonlStr: string): RecordingEntry[] {
  try {
    return jsonlStr
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.event?.kind === "command_output");
  } catch {
    return [];
  }
}

// 执行历史表格组件 - 展示 recording JSONL 中的命令
function ExecutionHistoryTable({ history }: { history: ExecutionHistory[] }) {
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

  // 解析所有执行历史中的 recording entries
  const allEntries: Array<{
    id: string;
    entry: RecordingEntry;
    historyId: string;
    createdAt: Date;
  }> = [];

  history.forEach((h) => {
    try {
      const parsed = JSON.parse(h.output);
      const recordingJsonl = parsed.recording_jsonl || "";
      const entries = parseRecordingJsonl(recordingJsonl);
      entries.forEach((entry, idx) => {
        allEntries.push({
          id: `${h.id}-${idx}`,
          entry,
          historyId: h.id,
          createdAt: h.createdAt,
        });
      });
    } catch {
      // 如果解析失败，跳过
    }
  });

  if (allEntries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t("taskDetailHistoryNoOutput")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 w-8">{t("taskDetailHistoryIndex")}</th>
            <th className="text-left px-3 py-2">{t("taskDetailHistoryCommand")}</th>
            <th className="text-left px-3 py-2 w-20">{t("taskDetailHistoryStatus")}</th>
            <th className="text-left px-3 py-2 w-24">Mode</th>
            <th className="text-right px-3 py-2 w-36">{t("taskDetailHistoryTime")}</th>
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
                <td colSpan={5} className="p-0">
                  <div
                    className={`
                      flex items-center transition-colors
                      ${hasOutput ? "cursor-pointer" : ""}
                      ${isFailed
                        ? "bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-l-4 border-rose-400"
                        : "hover:bg-muted/30"
                      }
                    `}
                    onClick={() => hasOutput && toggleRow(item.id)}
                  >
                    {/* # */}
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
                    {/* Command */}
                    <span className="px-3 py-2 flex-1 min-w-0">
                      <code className="font-mono text-xs break-all">
                        {entry.event.command || "—"}
                      </code>
                    </span>
                    {/* Status */}
                    <span className="px-3 py-2 w-20 shrink-0">
                      <span
                        className={`
                          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium
                          ${isFailed
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
                        {isFailed ? t("taskDetailHistoryFailed") : t("taskDetailHistorySuccess")}
                      </span>
                    </span>
                    {/* Mode */}
                    <span className="px-3 py-2 w-24 shrink-0">
                      {entry.event.mode && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {entry.event.mode}
                        </span>
                      )}
                    </span>
                    {/* Time */}
                    <span className="px-3 py-2 w-36 text-right text-xs text-muted-foreground shrink-0">
                      {new Date(entry.ts_ms).toLocaleString()}
                    </span>
                  </div>

                  {/* 展开的输出区域 */}
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

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
}: TaskDetailDialogProps) {
  const t = useTranslations("dialogs");
  const tc = useTranslations("common");

  if (!task) return null;

  const statusConfig = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const typeConfig = TYPE_LABELS[task.dispatchType] ?? TYPE_LABELS.exec;
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <TypeIcon className="h-5 w-5 shrink-0" />
            <span className="truncate">{task.name}</span>
          </DialogTitle>
          <DialogDescription>{task.description || tc("noDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 基本信息 */}
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
            <InfoRow label={t("taskDetailAgentCount")}>{task.agentIds.length}</InfoRow>
            <InfoRow label={t("taskDetailCreatedAt")}>
              {new Date(task.createdAt).toLocaleString()}
            </InfoRow>
            {task.startedAt && (
              <InfoRow label={t("taskDetailStartedAt")}>
                {new Date(task.startedAt).toLocaleString()}
              </InfoRow>
            )}
            {task.completedAt && (
              <InfoRow label={t("taskDetailCompletedAt")}>
                {new Date(task.completedAt).toLocaleString()}
              </InfoRow>
            )}
          </div>

          <Separator />

          {/* Payload — 结构化展示 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("taskDetailPayload")}</h4>
            <PayloadRenderer
              dispatchType={task.dispatchType}
              payload={task.payload}
            />
          </div>

          <Separator />

          {/* Result — 结构化展示 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("taskDetailResult")}</h4>
            <ResultRenderer
              dispatchType={task.dispatchType}
              result={task.result}
            />
          </div>

          {/* 执行历史 — 表格展示 */}
          {task.executionHistory && task.executionHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("taskDetailHistory")}</h4>
                <ExecutionHistoryTable history={task.executionHistory} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
