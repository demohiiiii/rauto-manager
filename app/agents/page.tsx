"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RegisterAgentDialog } from "@/components/register-agent-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { Agent } from "@/lib/types";
import { useTranslations } from "next-intl";

function AgentStatusBadge({ status }: { status: Agent["status"] }) {
  const t = useTranslations("agents");
  const config = {
    online: {
      labelKey: "statusOnline",
      variant: "default" as const,
      icon: Wifi,
      className: "bg-green-600 hover:bg-green-700",
    },
    offline: {
      labelKey: "statusOffline",
      variant: "secondary" as const,
      icon: WifiOff,
      className: "",
    },
    error: {
      labelKey: "statusError",
      variant: "destructive" as const,
      icon: AlertTriangle,
      className: "",
    },
  };

  const { labelKey, variant, icon: Icon, className } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {t(labelKey)}
    </Badge>
  );
}

function AgentCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const t = useTranslations("agents");
  const tc = useTranslations("common");
  const { data, isLoading, error } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const agents = data?.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="hover-scale">
              <RefreshCw className="h-4 w-4 mr-2" />
              {tc("refresh")}
            </Button>
            <RegisterAgentDialog>
              <Button size="sm" className="hover-scale">
                <Plus className="h-4 w-4 mr-2" />
                {t("registerAgent")}
              </Button>
            </RegisterAgentDialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3 animate-fade-in stagger-1">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalAgents")}</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agents.length}</div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("onlineAgents")}</CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {agents.filter((a) => a.status === "online").length}
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("errorAgents")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {agents.filter((a) => a.status === "error").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <p>{tc("loadFailed", { message: String(error) })}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && agents.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <Server className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("noAgentsTitle")}</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t("noAgentsDescription")}
              </p>
              <RegisterAgentDialog>
                <Button className="hover-scale">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("registerAgent")}
                </Button>
              </RegisterAgentDialog>
            </CardContent>
          </Card>
        )}

        {/* Agent Cards */}
        {!isLoading && agents.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, index) => (
              <Card
                key={agent.id}
                className={`hover-lift animate-fade-in stagger-${Math.min(index + 1, 4)}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <AgentStatusBadge status={agent.status} />
                  </div>
                  <CardDescription>
                    {agent.host}:{agent.port}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{tc("version")}</span>
                    <span className="font-medium">{agent.version ?? tc("unknown")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{tc("capabilities")}</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {agent.capabilities.length > 0 ? (
                        agent.capabilities.map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {cap}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">{tc("none")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1 hover-scale">
                      {tc("viewDetails")}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 hover-scale">
                      <Activity className="h-3 w-3 mr-1" />
                      {t("healthCheck")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
