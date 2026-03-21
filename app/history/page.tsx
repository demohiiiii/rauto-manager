"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { HistoryDetailDialog } from "@/components/history-detail-dialog";
import { apiClient } from "@/lib/api/client";
import type { DispatchType, ExecutionHistoryRecord } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  History,
  RefreshCw,
  Search,
  Terminal,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatAgentReportMode } from "@/lib/utils";

const DISPATCH_TYPE_CONFIG: Record<
  DispatchType,
  { labelKey: string; className: string }
> = {
  exec: {
    labelKey: "commandExec",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  template: {
    labelKey: "templateExec",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  tx_block: {
    labelKey: "txBlock",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  tx_workflow: {
    labelKey: "txWorkflow",
    className:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  orchestrate: {
    labelKey: "multiDeviceOrchestrate",
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
};

function HistoryStatusBadge({
  status,
}: {
  status: ExecutionHistoryRecord["status"];
}) {
  const tc = useTranslations("common");
  const config = {
    success: {
      icon: CheckCircle2,
      className: "bg-green-600 hover:bg-green-700",
      labelKey: "success",
      variant: "default" as const,
    },
    failed: {
      icon: XCircle,
      className: "",
      labelKey: "failed",
      variant: "destructive" as const,
    },
  };

  const { icon: Icon, className, labelKey, variant } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {tc(labelKey)}
    </Badge>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function summarizeOutput(output: string): string {
  try {
    const parsed = JSON.parse(output);
    const normalized =
      typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    return normalized.replace(/\s+/g, " ").trim();
  } catch {
    return output.replace(/\s+/g, " ").trim();
  }
}

function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(records: ExecutionHistoryRecord[]) {
  const header = [
    "Executed At",
    "Task",
    "Agent",
    "Device",
    "Dispatch Type",
    "Status",
    "Execution Time (ms)",
    "Command",
    "Output",
  ];

  const rows = records.map((record) => [
    new Date(record.createdAt).toISOString(),
    record.task?.name ?? "",
    record.agent?.name ?? "",
    record.device?.name ?? "",
    record.task?.dispatchType ?? "",
    record.status,
    String(record.executionTime),
    record.command,
    record.output,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `execution-history-${new Date().toISOString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const t = useTranslations("history");
  const tc = useTranslations("common");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">(
    "all"
  );
  const [agentFilter, setAgentFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState<"all" | "24h" | "7d" | "30d">(
    "7d"
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedRecord, setSelectedRecord] =
    useState<ExecutionHistoryRecord | null>(null);

  const deferredSearch = useDeferredValue(search.trim());

  const { data: agentsResponse } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "history",
      deferredSearch,
      statusFilter,
      agentFilter,
      rangeFilter,
      page,
      limit,
    ],
    queryFn: () =>
      apiClient.getExecutionHistory({
        search: deferredSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        agentId: agentFilter === "all" ? undefined : agentFilter,
        range: rangeFilter,
        page,
        limit,
      }),
  });

  const historyData = data?.data;
  const records = historyData?.records ?? [];
  const stats = historyData?.stats ?? {
    totalExecutions: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
    averageDuration: 0,
  };
  const agents = agentsResponse?.data ?? [];
  const apiErrorMessage = data && !data.success ? data.error ?? tc("unknownError") : null;
  const totalRecords = data?.meta?.total ?? stats.totalExecutions;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const pageStart = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, totalRecords);
  const hasFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    agentFilter !== "all" ||
    rangeFilter !== "7d";

  useEffect(() => {
    if (!isLoading && totalRecords > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [isLoading, page, totalPages, totalRecords]);

  const handleExport = () => {
    if (!records.length) {
      toast.error(t("noDataToExport"));
      return;
    }

    try {
      downloadCsv(records);
      toast.success(t("exportSuccess", { count: records.length }));
    } catch (exportError) {
      toast.error(t("exportFailed"));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setAgentFilter("all");
    setRangeFilter("7d");
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hover-scale"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
              />
              {tc("refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover-scale"
              onClick={handleExport}
              disabled={!records.length}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("export")}
            </Button>
          </div>
        </div>

        <Card className="animate-fade-in stagger-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t("filter")}
            </CardTitle>
            <CardDescription>{t("latestRecordsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{tc("command")}</label>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("searchPlaceholder")}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("statusFilter")}</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as "all" | "success" | "failed");
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses")}</SelectItem>
                  <SelectItem value="success">{tc("success")}</SelectItem>
                  <SelectItem value="failed">{tc("failed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("agentFilter")}</label>
              <Select
                value={agentFilter}
                onValueChange={(value) => {
                  setAgentFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allAgents")}</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} · {formatAgentReportMode(agent.reportMode)} · {agent.host}:{agent.port}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("timeRange")}</label>
              <Select
                value={rangeFilter}
                onValueChange={(value) => {
                  setRangeFilter(value as "all" | "24h" | "7d" | "30d");
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">{t("last24Hours")}</SelectItem>
                  <SelectItem value="7d">{t("last7Days")}</SelectItem>
                  <SelectItem value="30d">{t("last30Days")}</SelectItem>
                  <SelectItem value="all">{t("allTime")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <div className="md:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <StatsSkeleton />
        ) : (
          <div className="grid gap-4 md:grid-cols-4 animate-fade-in stagger-2">
            <Card className="hover-lift">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalExecutions")}
                </CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalExecutions}</div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("successRate")}
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.totalExecutions ? `${stats.successRate}%` : "--"}
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("failedCount")}
                </CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats.failedCount}
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("averageDuration")}
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalExecutions
                    ? formatDuration(stats.averageDuration)
                    : "--"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {(error || apiErrorMessage) && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <p>
                  {t("fetchHistoryFailed", {
                    message:
                      apiErrorMessage ??
                      (error instanceof Error ? error.message : tc("unknownError")),
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <TableSkeleton />
        ) : records.length > 0 ? (
          <Card className="animate-fade-in stagger-3">
            <CardHeader>
              <CardTitle>{t("latestRecords")}</CardTitle>
              <CardDescription>
                {t("currentRecordsCount", { count: totalRecords })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("executedAt")}</TableHead>
                    <TableHead>{t("task")}</TableHead>
                    <TableHead>{t("agent")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>{t("executionDuration")}</TableHead>
                    <TableHead>{tc("command")}</TableHead>
                    <TableHead>{t("outputPreview")}</TableHead>
                    <TableHead className="text-right">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const dispatchType = record.task?.dispatchType
                      ? DISPATCH_TYPE_CONFIG[record.task.dispatchType]
                      : null;

                    return (
                      <TableRow key={record.id} className="hover-lift">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {record.task?.name ?? tc("unknown")}
                            </div>
                            {dispatchType && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${dispatchType.className}`}
                              >
                                <Terminal className="h-3 w-3 mr-1" />
                                {tc(dispatchType.labelKey)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {record.agent?.name ?? tc("unknown")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.device?.name ?? tc("notSet")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <HistoryStatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDuration(record.executionTime)}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <code className="text-xs font-mono break-all">
                            {record.command}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                          <div className="line-clamp-3">
                            {summarizeOutput(record.output) || tc("noData")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t("viewOutput")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("paginationSummary", {
                    start: pageStart,
                    end: pageEnd,
                    total: totalRecords,
                  })}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("rowsPerPage")}
                    </span>
                    <Select
                      value={String(limit)}
                      onValueChange={(value) => {
                        setLimit(Number(value));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[88px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("pageLabel", { page, totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1 || isFetching}
                    >
                      {t("previousPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={page >= totalPages || isFetching}
                    >
                      {t("nextPage")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : hasFilters ? (
          <Card className="animate-fade-in stagger-3">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {t("noFilteredRecordsTitle")}
              </h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t("noFilteredRecordsDescription")}
              </p>
              <Button variant="outline" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-fade-in stagger-3">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <History className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {t("noRecordsTitle")}
              </h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t("noRecordsDescription")}
              </p>
              <Badge variant="outline" className="text-sm">
                <Clock className="h-3 w-3 mr-1" />
                {t("waitingForFirstExecution")}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      <HistoryDetailDialog
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null);
          }
        }}
        record={selectedRecord}
      />
    </DashboardLayout>
  );
}
