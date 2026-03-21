"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, TestTube, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api/client";
import { formatAgentReportMode, isAgentAvailableStatus } from "@/lib/utils";

interface AddDeviceDialogProps {
  children: React.ReactNode;
}

export function AddDeviceDialog({ children }: AddDeviceDialogProps) {
  const t = useTranslations("dialogs");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "failed" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [deviceProfiles, setDeviceProfiles] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    password: "",
    enablePassword: "",
    deviceProfile: "",
    agentId: "",
    sshSecurity: "balanced" as "secure" | "balanced" | "legacy-compatible",
  });

  // Fetch the available agent list
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const availableAgents = (agentsData?.data ?? []).filter((a) =>
    isAgentAvailableStatus(a.status)
  );

  // When an agent is selected, fetch its supported device profiles through the Manager proxy
  useEffect(() => {
    if (!formData.agentId) {
      setDeviceProfiles([]);
      return;
    }

    const fetchProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const response = await fetch(`/api/agents/${formData.agentId}/device-profiles`);
        const result = await response.json();

        if (result.success && result.data?.all) {
          setDeviceProfiles(result.data.all);
        } else {
          toast.error(t("fetchDeviceProfilesFailed", { error: result.error || tc("unknownError") }));
        }
      } catch (error) {
        toast.error(t("fetchDeviceProfilesFailed", { error: error instanceof Error ? error.message : tc("unknownError") }));
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.agentId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);

    // Clear the selected device profile when switching agents
    if (field === "agentId") {
      setFormData((prev) => ({ ...prev, deviceProfile: "" }));
    }
  };

  const handleTestConnection = async () => {
    if (!formData.agentId || !formData.host || !formData.username || !formData.deviceProfile) {
      toast.error(t("testRequiredFields"));
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/agents/${formData.agentId}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          enablePassword: formData.enablePassword || undefined,
          deviceProfile: formData.deviceProfile,
          sshSecurity: formData.sshSecurity,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult("success");
        toast.success(t("testConnectionSuccess"));
      } else {
        setTestResult("failed");
        toast.error(t("testConnectionFailed", { error: result.error || tc("unknownError") }));
      }
    } catch (error) {
      setTestResult("failed");
      toast.error(t("testConnectionFailed", { error: error instanceof Error ? error.message : tc("unknownError") }));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.agentId || !formData.host || !formData.deviceProfile || !formData.username || !formData.password) {
      toast.error(t("requiredFieldsIncludingPassword"));
      return;
    }

    setSubmitting(true);

    try {
      // 1. Sync to the rauto Agent through the Manager proxy first (save the connection config)
      const saveConnectionResponse = await fetch(`/api/agents/${formData.agentId}/connections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          enablePassword: formData.enablePassword || undefined,
          deviceProfile: formData.deviceProfile,
          sshSecurity: formData.sshSecurity,
          savePassword: true,
        }),
      });

      const saveResult = await saveConnectionResponse.json();
      if (!saveResult.success) {
        throw new Error(t("syncToRautoFailed", { error: saveResult.error || tc("unknownError") }));
      }

      // 2. Then persist the device in the Manager database
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: formData.agentId,
          name: formData.name,
          type: formData.deviceProfile,
          host: formData.host,
          port: parseInt(formData.port),
          metadata: {
            username: formData.username,
            connectionName: formData.name,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t("addDeviceSuccess"));
        queryClient.invalidateQueries({ queryKey: ["devices"] });
        setOpen(false);
        setFormData({
          name: "",
          host: "",
          port: "22",
          username: "",
          password: "",
          enablePassword: "",
          deviceProfile: "",
          agentId: "",
          sshSecurity: "balanced",
        });
        setTestResult(null);
      } else {
        toast.error(t("addDeviceFailed", { error: result.error ?? tc("unknownError") }));
      }
    } catch (error) {
      toast.error(t("addDeviceFailed", { error: error instanceof Error ? error.message : tc("unknownError") }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("addDeviceTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("addDeviceDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agent">
              {t("belongsToAgent")} <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.agentId} onValueChange={(v) => handleInputChange("agentId", v)}>
              <SelectTrigger id="agent">
                <SelectValue placeholder={t("selectOnlineAgent")} />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">{t("noOnlineAgents")}</div>
                ) : (
                  availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} · {formatAgentReportMode(agent.reportMode)} · {agent.host}:{agent.port}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              {t("deviceName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t("deviceNamePlaceholder")}
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("deviceNameHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile">
              {t("deviceProfile")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.deviceProfile}
              onValueChange={(v) => handleInputChange("deviceProfile", v)}
              disabled={!formData.agentId || loadingProfiles}
            >
              <SelectTrigger id="profile">
                <SelectValue placeholder={loadingProfiles ? t("loadingProfiles") : t("selectDeviceProfile")} />
              </SelectTrigger>
              <SelectContent>
                {deviceProfiles.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    {formData.agentId ? t("noDeviceProfiles") : t("selectAgentFirst")}
                  </div>
                ) : (
                  deviceProfiles.map((profile) => (
                    <SelectItem key={profile} value={profile}>
                      {profile}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("deviceProfileHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sshSecurity">
              {t("sshSecurityLevel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.sshSecurity}
              onValueChange={(v) => handleInputChange("sshSecurity", v as "secure" | "balanced" | "legacy-compatible")}
            >
              <SelectTrigger id="sshSecurity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secure">{t("sshSecuritySecure")}</SelectItem>
                <SelectItem value="balanced">{t("sshSecurityBalanced")}</SelectItem>
                <SelectItem value="legacy-compatible">{t("sshSecurityLegacy")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("sshSecurityHint")}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="host">
                {t("hostAddress")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="host"
                placeholder={t("hostPlaceholder")}
                value={formData.host}
                onChange={(e) => handleInputChange("host", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">{t("port")}</Label>
              <Input
                id="port"
                type="number"
                placeholder="22"
                value={formData.port}
                onChange={(e) => handleInputChange("port", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">
              {t("sshUsername")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              placeholder={t("sshUsernamePlaceholder")}
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {t("sshPassword")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={t("sshPasswordPlaceholder")}
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("passwordStorageHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="enablePassword">{t("enablePassword")}</Label>
            <Input
              id="enablePassword"
              type="password"
              placeholder={t("enablePasswordPlaceholder")}
              value={formData.enablePassword}
              onChange={(e) => handleInputChange("enablePassword", e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !formData.agentId || !formData.host || !formData.username || !formData.deviceProfile}
              className="gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("testing")}
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  {t("testConnection")}
                </>
              )}
            </Button>

            {testResult === "success" && (
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {t("connectionSuccess")}
              </div>
            )}

            {testResult === "failed" && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {t("connectionFailed")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.name || !formData.agentId || !formData.host || !formData.deviceProfile || !formData.username || !formData.password}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("adding")}
              </>
            ) : (
              t("addDeviceButton")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
