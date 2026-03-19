"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AddDeviceDialog } from "@/components/add-device-dialog";
import { DeviceDetailDialog } from "@/components/device-detail-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Network,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  HelpCircle,
  Eye,
  Trash2,
  Server,
  Loader2,
} from "lucide-react";
import type { Device } from "@/lib/types";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isAgentAvailableStatus } from "@/lib/utils";

function DeviceStatusBadge({
  status,
  reason,
}: {
  status: Device["status"];
  reason?: Device["statusReason"];
}) {
  const t = useTranslations("devices");
  const config = {
    reachable: {
      labelKey: "statusReachable",
      variant: "default" as const,
      icon: Wifi,
      className: "bg-green-600 hover:bg-green-700",
    },
    unreachable: {
      labelKey: "statusUnreachable",
      variant: "destructive" as const,
      icon: WifiOff,
      className: "",
    },
    unknown: {
      labelKey: "statusUnknown",
      variant: "secondary" as const,
      icon: HelpCircle,
      className: "",
    },
  };

  const { labelKey, variant, icon: Icon, className } = config[status];

  return (
    <div className="space-y-1">
      <Badge variant={variant} className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {t(labelKey)}
      </Badge>
      {reason === "agent_offline" && (
        <p className="text-xs text-muted-foreground">
          {t("statusReasonAgentOffline")}
        </p>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function DevicesPage() {
  const t = useTranslations("devices");
  const tc = useTranslations("common");
  const td = useTranslations("dialogs");
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiClient.getDevices(),
  });

  const devices = data?.data ?? [];

  const deleteDeviceMutation = useMutation({
    mutationFn: (device: Device) => apiClient.deleteDevice(device.id),
    onSuccess: (result, device) => {
      if (result.success) {
        toast.success(t("deleteDeviceSuccess", { name: device.name }));
        queryClient.invalidateQueries({ queryKey: ["devices"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } else {
        toast.error(
          t("deleteDeviceFailed", {
            error: result.error ?? tc("unknownError"),
          })
        );
      }
    },
    onError: (error: Error) => {
      toast.error(t("deleteDeviceFailed", { error: error.message }));
    },
    onSettled: () => {
      setDeviceToDelete(null);
    },
  });

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
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
              />
              {tc("refresh")}
            </Button>
            <AddDeviceDialog>
              <Button size="sm" className="hover-scale">
                <Plus className="h-4 w-4 mr-2" />
                {t("addDevice")}
              </Button>
            </AddDeviceDialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3 animate-fade-in stagger-1">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalDevices")}</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{devices.length}</div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("reachable")}</CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {devices.filter((d) => d.status === "reachable").length}
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("unreachable")}</CardTitle>
              <WifiOff className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {devices.filter((d) => d.status === "unreachable").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <WifiOff className="h-5 w-5" />
                <p>{tc("loadFailed", { message: String(error) })}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>{t("deviceList")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TableSkeleton />
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && devices.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <Network className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("noDevicesTitle")}</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t("noDevicesDescription")}
              </p>
              <AddDeviceDialog>
                <Button className="hover-scale">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addDevice")}
                </Button>
              </AddDeviceDialog>
            </CardContent>
          </Card>
        )}

        {/* Device Table */}
        {!isLoading && devices.length > 0 && (
          <Card className="animate-fade-in stagger-2">
            <CardHeader>
              <CardTitle>{t("deviceList")}</CardTitle>
              <CardDescription>
                {t("totalDeviceCount", { count: devices.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("deviceName")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("address")}</TableHead>
                    <TableHead>{t("belongsToAgent")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead className="text-right">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} className="hover-lift">
                      <TableCell className="font-medium">{device.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{device.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {device.host}
                        {device.port ? `:${device.port}` : ""}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{device.agent?.name || tc("unknown")}</span>
                          {isAgentAvailableStatus(device.agent?.status) && (
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="在线" />
                          )}
                          {device.agent?.status === "offline" && (
                            <div className="h-2 w-2 rounded-full bg-gray-400" title="离线" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DeviceStatusBadge
                          status={device.status}
                          reason={device.statusReason}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover-scale"
                            onClick={() => setSelectedDevice(device)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover-scale text-destructive hover:text-destructive"
                            onClick={() => setDeviceToDelete(device)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <DeviceDetailDialog
        open={Boolean(selectedDevice)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDevice(null);
          }
        }}
        device={selectedDevice}
      />
      <AlertDialog
        open={Boolean(deviceToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setDeviceToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{td("deviceDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deviceToDelete
                ? td("deviceDeleteDescription", { name: deviceToDelete.name })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDeviceMutation.isPending}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!deviceToDelete) {
                  return;
                }
                deleteDeviceMutation.mutate(deviceToDelete);
              }}
              disabled={deleteDeviceMutation.isPending}
            >
              {deleteDeviceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {td("deviceDeleting")}
                </>
              ) : (
                tc("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
