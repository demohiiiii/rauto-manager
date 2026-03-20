"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { OutputBlock } from "./shared";

interface RecordingEventPayload {
  kind?: string;
  command?: string;
  mode?: string;
  success?: boolean;
  content?: string;
  all?: string;
}

export interface RecordingEntry {
  ts_ms: number;
  event: RecordingEventPayload;
}

export function parseRecordingJsonl(jsonl: string | null | undefined): RecordingEntry[] {
  if (!jsonl?.trim()) {
    return [];
  }

  try {
    return jsonl
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RecordingEntry)
      .filter((entry) => entry.event?.kind === "command_output");
  } catch {
    return [];
  }
}

interface CommandEchoTableProps {
  recordingJsonl?: string | null;
  emptyText?: string;
}

export function CommandEchoTable({
  recordingJsonl,
  emptyText,
}: CommandEchoTableProps) {
  const t = useTranslations("dialogs");
  const entries = parseRecordingJsonl(recordingJsonl);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  if (entries.length === 0) {
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
            <th className="text-left px-3 py-2 w-10">
              {t("taskDetailHistoryIndex")}
            </th>
            <th className="text-left px-3 py-2">
              {t("taskDetailHistoryCommand")}
            </th>
            <th className="text-left px-3 py-2 w-24">
              {t("taskDetailHistoryStatus")}
            </th>
            <th className="text-left px-3 py-2 w-24">
              Mode
            </th>
            <th className="text-right px-3 py-2 w-40">
              {t("taskDetailHistoryTime")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry, index) => {
            const isFailed = entry.event.success === false;
            const output = entry.event.content || entry.event.all || "";
            const hasOutput = Boolean(output);
            const isExpanded = expandedRows.has(index);

            return (
              <tr key={`${entry.ts_ms}-${index}`}>
                <td colSpan={5} className="p-0">
                  <button
                    type="button"
                    className={`
                      w-full text-left flex items-center
                      ${hasOutput ? "cursor-pointer" : "cursor-default"}
                      ${
                        isFailed
                          ? "bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-l-4 border-rose-400"
                          : "hover:bg-muted/30"
                      }
                    `}
                    onClick={() => {
                      if (hasOutput) {
                        toggleRow(index);
                      }
                    }}
                  >
                    <span className="px-3 py-2 w-10 text-xs text-muted-foreground shrink-0">
                      {hasOutput ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="px-3 py-2 flex-1 min-w-0">
                      <code className="font-mono text-xs break-all">
                        {entry.event.command || "—"}
                      </code>
                    </span>
                    <span className="px-3 py-2 w-24 shrink-0">
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
                      {entry.event.mode ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {entry.event.mode}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="px-3 py-2 w-40 text-right text-xs text-muted-foreground shrink-0">
                      {new Date(entry.ts_ms).toLocaleString()}
                    </span>
                  </button>

                  {isExpanded && hasOutput && (
                    <div className="px-3 pb-3 pt-1 bg-muted/20">
                      <div className="text-xs text-muted-foreground mb-1 font-medium">
                        {t("taskDetailHistoryOutput")}
                      </div>
                      <OutputBlock
                        content={output}
                        maxHeight="180px"
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
