"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Zap,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  StopCircle,
  Eye,
  Terminal,
  FileCode,
  Layers,
  GitBranch,
  Network,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Task, DispatchType, ExecutionHistory } from "@/lib/types";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { TaskDetailDialog } from "@/components/task-detail-dialog";
import { useTranslations } from "next-intl";

// Dispatch type config (labelKey for i18n)
const DISPATCH_TYPE_CONFIG: Record<
  DispatchType,
  { labelKey: string; icon: typeof Terminal; className: string }
> = {
  exec: { labelKey: "singleCommand", icon: Terminal, className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
  template: { labelKey: "template", icon: FileCode, className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  tx_block: { labelKey: "txBlock", icon: Layers, className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  tx_workflow: { labelKey: "workflow", icon: GitBranch, className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" },
  orchestrate: { labelKey: "orchestrate", icon: Network, className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
};

function TaskStatusBadge({ status }: { status: Task["status"] }) {
  const t = useTranslations("tasks");
  const config = {
    pending: {
      labelKey: "statusPending",
      variant: "secondary" as const,
      icon: Clock,
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    running: {
      labelKey: "statusRunning",
      variant: "default" as const,
      icon: Play,
      className: "bg-blue-600 hover:bg-blue-700 animate-pulse",
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
      icon: StopCircle,
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

function DispatchTypeBadge({ type }: { type: DispatchType }) {
  const tc = useTranslations("common");
  const config = DISPATCH_TYPE_CONFIG[type] ?? DISPATCH_TYPE_CONFIG.exec;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {tc(config.labelKey)}
    </Badge>
  );
}

function TaskCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<(Task & { executionHistory?: ExecutionHistory[] }) | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "execute" | "cancel";
    task: Task;
  } | null>(null);

  const queryClient = useQueryClient();

  // 查询任务列表（有 running 任务时自动轮询）
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiClient.getTasks(),
    refetchInterval: (query) => {
      const tasks = query.state.data?.data ?? [];
      const hasRunning = tasks.some((t: Task) => t.status === "running");
      return hasRunning ? 5000 : false;
    },
  });

  const tasks = data?.data ?? [];

  // 执行任务 mutation
  const executeMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.executeTask(taskId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("taskStarted"));
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } else {
        toast.error(t("executeFailed", { error: result.error ?? "" }));
      }
    },
    onError: (error: Error) => {
      toast.error(t("executeFailed", { error: error.message }));
    },
  });

  // 取消任务 mutation
  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.cancelTask(taskId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("taskCancelled"));
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } else {
        toast.error(t("cancelFailed", { error: result.error ?? "" }));
      }
    },
    onError: (error: Error) => {
      toast.error(t("cancelFailed", { error: error.message }));
    },
  });

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "execute") {
      executeMutation.mutate(confirmAction.task.id);
    } else {
      cancelMutation.mutate(confirmAction.task.id);
    }
    setConfirmAction(null);
  };

  const isActionLoading = executeMutation.isPending || cancelMutation.isPending;

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
            <Button
              variant="outline"
              size="sm"
              className="hover-scale"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {tc("refresh")}
            </Button>
            <Button
              size="sm"
              className="hover-scale"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("createTask")}
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 animate-fade-in stagger-1">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalTasks")}</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("successTasks")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {tasks.filter((t) => t.status === "success").length}
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("runningTasks")}</CardTitle>
              <Play className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {tasks.filter((t) => t.status === "running").length}
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("failedTasks")}</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {tasks.filter((t) => t.status === "failed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <p>{tc("loadFailed", { message: String(error) })}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tasks.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <Zap className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("noTasksTitle")}</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t("noTasksDescription")}
              </p>
              <Button
                className="hover-scale"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("createTask")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Task Cards */}
        {!isLoading && tasks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task, index) => (
              <Card
                key={task.id}
                className={`hover-lift animate-fade-in stagger-${Math.min(index + 1, 4)}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg truncate">{task.name}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <DispatchTypeBadge type={task.dispatchType} />
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>
                  {task.description && (
                    <CardDescription>{task.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("agentCount")}</span>
                    <span className="font-medium">{task.agentIds.length}</span>
                  </div>
                  {task.template && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{tc("template")}</span>
                      <Badge variant="outline" className="text-xs">
                        {task.template}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("createdAt")}</span>
                    <span className="text-xs">
                      {new Date(task.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover-scale"
                      onClick={() => setDetailTask(task as Task & { executionHistory?: ExecutionHistory[] })}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {t("details")}
                    </Button>
                    {task.status === "pending" && (
                      <Button
                        size="sm"
                        className="flex-1 hover-scale bg-green-600 hover:bg-green-700"
                        disabled={isActionLoading}
                        onClick={() => setConfirmAction({ type: "execute", task })}
                      >
                        {executeMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        {t("execute")}
                      </Button>
                    )}
                    {(task.status === "running" || task.status === "pending") && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className={`hover-scale ${task.status === "pending" ? "" : "flex-1"}`}
                        disabled={isActionLoading}
                        onClick={() => setConfirmAction({ type: "cancel", task })}
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <StopCircle className="h-3 w-3 mr-1" />
                        )}
                        {t("cancelTask")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* 任务详情对话框 */}
      <TaskDetailDialog
        open={!!detailTask}
        onOpenChange={(open) => { if (!open) setDetailTask(null); }}
        task={detailTask}
      />

      {/* 确认操作对话框 */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "execute" ? t("confirmExecuteTitle") : t("confirmCancelTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "execute"
                ? t("confirmExecuteDescription", { name: confirmAction?.task.name ?? "" })
                : t("confirmCancelDescription", { name: confirmAction?.task.name ?? "" })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmAction?.type === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmAction?.type === "execute" ? t("confirmExecute") : t("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
