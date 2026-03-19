"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { apiClient } from "@/lib/api/client";
import type {
  DispatchType,
  ExecutionHistoryRecord,
  GlobalSearchResults,
  SearchAgentResult,
  SearchDeviceResult,
  SearchTaskResult,
} from "@/lib/types";
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
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Network,
  RefreshCw,
  Search,
  Server,
  Terminal,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

const MIN_QUERY_LENGTH = 2;

const DISPATCH_TYPE_KEYS: Record<DispatchType, string> = {
  exec: "commandExec",
  template: "templateExec",
  tx_block: "txBlock",
  tx_workflow: "txWorkflow",
  orchestrate: "multiDeviceOrchestrate",
};

function formatTime(
  date: string | Date,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const now = Date.now();
  const target = new Date(date).getTime();
  const diff = now - target;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("timeJustNow");
  if (minutes < 60) return t("timeMinutesAgo", { count: minutes });
  if (hours < 24) return t("timeHoursAgo", { count: hours });
  return t("timeDaysAgo", { count: days });
}

function summarizeOutput(output: string, fallback: string): string {
  const normalized = output.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function SearchStatusBadge({
  status,
}: {
  status: SearchTaskResult["status"] | ExecutionHistoryRecord["status"];
}) {
  const t = useTranslations("tasks");
  const config = {
    pending: {
      labelKey: "statusPending",
      variant: "secondary" as const,
      icon: Clock,
      className: "",
    },
    running: {
      labelKey: "statusRunning",
      variant: "default" as const,
      icon: Clock,
      className: "bg-blue-600 hover:bg-blue-700",
    },
    success: {
      labelKey: "statusSuccess",
      variant: "default" as const,
      icon: CheckCircle2,
      className: "bg-green-600 hover:bg-green-700",
    },
    failed: {
      labelKey: "statusFailed",
      variant: "destructive" as const,
      icon: XCircle,
      className: "",
    },
    cancelled: {
      labelKey: "statusCancelled",
      variant: "secondary" as const,
      icon: XCircle,
      className: "",
    },
  };

  const { labelKey, variant, icon: Icon, className } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {t(labelKey)}
    </Badge>
  );
}

function AgentStatusBadge({ status }: { status: SearchAgentResult["status"] }) {
  const t = useTranslations("agents");
  const statusLabelKey = {
    online: "statusOnline",
    busy: "statusBusy",
    offline: "statusOffline",
    error: "statusError",
  } as const;
  const className = {
    online: "bg-green-600 hover:bg-green-700",
    busy: "bg-blue-600 hover:bg-blue-700",
    offline: "",
    error: "",
  } as const;
  const variant = {
    online: "default",
    busy: "default",
    offline: "secondary",
    error: "destructive",
  } as const;

  return (
    <Badge variant={variant[status]} className={className[status]}>
      {t(statusLabelKey[status])}
    </Badge>
  );
}

function DeviceStatusBadge({ device }: { device: SearchDeviceResult }) {
  const t = useTranslations("devices");
  const config = {
    reachable: {
      labelKey: "statusReachable",
      variant: "default" as const,
      className: "bg-green-600 hover:bg-green-700",
    },
    unreachable: {
      labelKey: "statusUnreachable",
      variant: "secondary" as const,
      className: "",
    },
    unknown: {
      labelKey: "statusUnknown",
      variant: "outline" as const,
      className: "",
    },
  };

  const { labelKey, variant, className } = config[device.status];

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant} className={className}>
        {t(labelKey)}
      </Badge>
      {device.statusReason === "agent_offline" ? (
        <span className="text-xs text-muted-foreground">
          {t("statusReasonAgentOffline")}
        </span>
      ) : null}
    </div>
  );
}

function SearchStats({ results }: { results: GlobalSearchResults }) {
  const t = useTranslations("search");
  const stats = [
    { key: "total", label: t("totalMatches"), value: results.total, icon: FileSearch },
    { key: "agents", label: t("agentMatches"), value: results.counts.agents, icon: Server },
    { key: "devices", label: t("deviceMatches"), value: results.counts.devices, icon: Network },
    { key: "tasks", label: t("taskMatches"), value: results.counts.tasks, icon: Terminal },
    { key: "history", label: t("historyMatches"), value: results.counts.history, icon: Activity },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {stats.map(({ key, label, value, icon: Icon }) => (
        <Card key={key} className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((__, itemIndex) => (
                <div key={itemIndex} className="rounded-lg border p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-52" />
                  <Skeleton className="mt-2 h-4 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SectionHeaderDescription({
  shown,
  total,
}: {
  shown: number;
  total: number;
}) {
  const t = useTranslations("search");

  return (
    <CardDescription>
      {total > shown
        ? t("showingTopMatches", { shown, total })
        : t("matchesFound", { count: total })}
    </CardDescription>
  );
}

function EmptySection({ label }: { label: string }) {
  const t = useTranslations("search");

  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {t("noMatchesInSection", { section: label })}
    </div>
  );
}

function SearchResultsGrid({
  results,
  query,
}: {
  results: GlobalSearchResults;
  query: string;
}) {
  const router = useRouter();
  const t = useTranslations("search");
  const tc = useTranslations("common");

  const historyTarget = useMemo(
    () => `/history?search=${encodeURIComponent(query)}`,
    [query]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>{t("agents")}</CardTitle>
          <SectionHeaderDescription
            shown={results.agents.length}
            total={results.counts.agents}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {results.agents.length ? (
            results.agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/40"
                onClick={() => router.push("/agents")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.host}:{agent.port}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("lastHeartbeat", {
                        time: formatTime(agent.lastHeartbeat, tc),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AgentStatusBadge status={agent.status} />
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.version ? (
                    <Badge variant="outline">{`${tc("version")}: ${agent.version}`}</Badge>
                  ) : null}
                  {agent.capabilities.slice(0, 3).map((capability) => (
                    <Badge key={capability} variant="secondary">
                      {capability}
                    </Badge>
                  ))}
                </div>
              </button>
            ))
          ) : (
            <EmptySection label={t("agents")} />
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>{t("devices")}</CardTitle>
          <SectionHeaderDescription
            shown={results.devices.length}
            total={results.counts.devices}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {results.devices.length ? (
            results.devices.map((device) => (
              <button
                key={device.id}
                type="button"
                className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/40"
                onClick={() => router.push("/devices")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {device.type} · {device.host}
                      {device.port ? `:${device.port}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {device.agent
                        ? t("deviceHostedBy", { name: device.agent.name })
                        : tc("unknown")}
                    </div>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <DeviceStatusBadge device={device} />
                </div>
              </button>
            ))
          ) : (
            <EmptySection label={t("devices")} />
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>{t("tasks")}</CardTitle>
          <SectionHeaderDescription
            shown={results.tasks.length}
            total={results.counts.tasks}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {results.tasks.length ? (
            results.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/40"
                onClick={() => router.push("/tasks")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">{task.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {task.description || tc("noDescription")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("taskCreatedAt", {
                        time: formatTime(task.createdAt, tc),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SearchStatusBadge status={task.status} />
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {tc(DISPATCH_TYPE_KEYS[task.dispatchType])}
                  </Badge>
                  <Badge variant="secondary">
                    {t("agentCount", { count: task.agentCount })}
                  </Badge>
                </div>
              </button>
            ))
          ) : (
            <EmptySection label={t("tasks")} />
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
          <SectionHeaderDescription
            shown={results.history.length}
            total={results.counts.history}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {results.history.length ? (
            results.history.map((record) => (
              <button
                key={record.id}
                type="button"
                className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/40"
                onClick={() => router.push(historyTarget)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {record.task?.name || record.command}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {record.command}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {summarizeOutput(
                        record.output,
                        t("outputPreviewUnavailable")
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("historyExecutedAt", {
                        time: formatTime(record.createdAt, tc),
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SearchStatusBadge status={record.status} />
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.agent ? (
                    <Badge variant="outline">{record.agent.name}</Badge>
                  ) : null}
                  {record.device ? (
                    <Badge variant="secondary">{record.device.name}</Badge>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <EmptySection label={t("history")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SearchPageClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const [query, setQuery] = useState(initialQuery);
  const [isRouting, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["search", deferredQuery],
    queryFn: () => apiClient.search(deferredQuery),
    enabled: deferredQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 30000,
  });

  const results = data?.data;
  const hasQuery = deferredQuery.length > 0;
  const canSearch = deferredQuery.length >= MIN_QUERY_LENGTH;
  const hasResults = Boolean(results?.total);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    const target = trimmedQuery
      ? `/search?q=${encodeURIComponent(trimmedQuery)}`
      : "/search";

    startTransition(() => {
      router.push(target);
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form
            className="flex w-full max-w-2xl items-center gap-2"
            onSubmit={handleSubmit}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isRouting}>
              {isRouting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {tc("search")}
            </Button>
          </form>
        </div>

        {canSearch ? (
          <p className="text-sm text-muted-foreground">
            {t("searchResultsFor", { query: deferredQuery })}
          </p>
        ) : null}

        {!hasQuery ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                {t("emptyDescription")}
              </p>
            </CardContent>
          </Card>
        ) : !canSearch ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">{t("minLengthTitle")}</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                {t("minLengthDescription", { count: MIN_QUERY_LENGTH })}
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <SearchPageSkeleton />
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <p className="text-destructive">
                {tc("loadFailed", { message: (error as Error).message })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                />
                {tc("retry")}
              </Button>
            </CardContent>
          </Card>
        ) : results && hasResults ? (
          <div className="space-y-6">
            <SearchStats results={results} />
            <SearchResultsGrid results={results} query={deferredQuery} />
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">{t("noResultsTitle")}</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                {t("noResultsDescription")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
