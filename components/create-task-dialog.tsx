"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap, Terminal, FileCode, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api/client";
import type { DispatchType } from "@/lib/types";
import { getDefaultRecordLevelForType } from "@/lib/record-level";
import { isAgentAvailableStatus } from "@/lib/utils";

import { ExecForm, buildExecPayload, validateExecForm, defaultExecFormData, type ExecFormData } from "@/components/task-forms/exec-form";
import { TemplateForm, buildTemplatePayload, validateTemplateForm, defaultTemplateFormData, type TemplateFormData } from "@/components/task-forms/template-form";
import { TxBlockForm, buildTxBlockPayload, validateTxBlockForm, defaultTxBlockFormData, type TxBlockFormData } from "@/components/task-forms/tx-block-form";

type SimpleDispatchType = Extract<DispatchType, "exec" | "template" | "tx_block">;

const DISPATCH_TYPE_CONFIG: {
  type: SimpleDispatchType;
  labelKey: string;
  icon: typeof Terminal;
}[] = [
  { type: "exec", labelKey: "singleCommand", icon: Terminal },
  { type: "template", labelKey: "template", icon: FileCode },
  { type: "tx_block", labelKey: "txBlock", icon: Layers },
];

interface ConnectionItem {
  name: string;
  host?: string;
  port?: number;
  device_profile?: string;
  has_password?: boolean;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const t = useTranslations("dialogs");
  const tc = useTranslations("common");
  const tf = useTranslations("taskForms");
  const [submitting, setSubmitting] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [dispatchType, setDispatchType] = useState<SimpleDispatchType>("exec");
  const [connectionName, setConnectionName] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [recordLevel, setRecordLevel] = useState<"Off" | "KeyEventsOnly" | "Full">(
    getDefaultRecordLevelForType("exec")
  );

  // Form state
  const [execData, setExecData] = useState<ExecFormData>(defaultExecFormData);
  const [templateData, setTemplateData] = useState<TemplateFormData>(defaultTemplateFormData);
  const [txBlockData, setTxBlockData] = useState<TxBlockFormData>(defaultTxBlockFormData);

  // Connection list
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const defaultRecordLevel = getDefaultRecordLevelForType(dispatchType);
  const shouldHighlightRecording = defaultRecordLevel !== "Off";

  const queryClient = useQueryClient();

  // Fetch the available agent list
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const availableAgents = (agentsData?.data ?? []).filter(
    (a) => isAgentAvailableStatus(a.status)
  );

  // Reload connections whenever the selected agent changes
  useEffect(() => {
    if (!agentId) {
      setConnections([]);
      return;
    }

    const fetchConnections = async () => {
      setLoadingConnections(true);
      try {
        const result = await apiClient.getAgentConnections(agentId);
        if (result.success && result.data?.connections) {
          setConnections(result.data.connections);
        } else if (!result.success) {
          toast.error(t("fetchConnectionsFailed", { error: result.error || tc("unknownError") }));
        }
      } catch (error) {
        toast.error(t("fetchConnectionsFailed", { error: error instanceof Error ? error.message : tc("unknownError") }));
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchConnections();
  }, [agentId]);

  // Reset the form
  const resetForm = () => {
    setAgentId("");
    setDispatchType("exec");
    setConnectionName("");
    setDryRun(false);
    setRecordLevel(getDefaultRecordLevelForType("exec"));
    setExecData(defaultExecFormData);
    setTemplateData(defaultTemplateFormData);
    setTxBlockData(defaultTxBlockFormData);
  };

  // Validate the form
  const validateForm = (): string | null => {
    if (!agentId) return t("selectAgent");
    if (!connectionName) return t("selectConnection");

    switch (dispatchType) {
      case "exec":
        return validateExecForm(execData, tf);
      case "template":
        return validateTemplateForm(templateData, tf);
      case "tx_block":
        return validateTxBlockForm(txBlockData, tf);
      default:
        return null;
    }
  };

  // Build the dispatch payload
  const buildPayload = (): Record<string, unknown> => {
    switch (dispatchType) {
      case "exec":
        return buildExecPayload(execData);
      case "template":
        return buildTemplatePayload(templateData);
      case "tx_block":
        return buildTxBlockPayload(txBlockData);
      default:
        return {};
    }
  };

  // Submit the task
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const payload = buildPayload();

      // Build the connection payload
      const connection = connectionName
        ? { connection_name: connectionName }
        : undefined;

      const result = await apiClient.dispatch({
        type: dispatchType,
        agent_id: agentId,
        connection,
        payload,
        dry_run: dryRun || undefined,
        record_level: recordLevel !== "Off" ? recordLevel : undefined,
      });

      if (result.success) {
        toast.success(t("taskDispatchedSuccess", { name: result.data?.agent_name ?? "" }));
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        onOpenChange(false);
        resetForm();
      } else {
        toast.error(t("dispatchFailed", { error: result.error ?? tc("unknownError") }));
      }
    } catch (error) {
      toast.error(
        t("dispatchFailed", { error: error instanceof Error ? error.message : tc("unknownError") })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t("createTaskTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("createTaskDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Agent selection */}
          <div className="space-y-2">
            <Label>
              {t("targetAgent")} <span className="text-destructive">*</span>
            </Label>
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); setConnectionName(""); }}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectOnlineAgent")} />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">{t("noOnlineAgents")}</div>
                ) : (
                  availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.host}:{agent.port})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dispatch type selection */}
          <div className="space-y-2">
            <Label>{t("dispatchType.label")}</Label>
            <div className="grid grid-cols-5 gap-2">
              {DISPATCH_TYPE_CONFIG.map(({ type, labelKey, icon: Icon }) => (
                <Button
                  key={type}
                  type="button"
                  variant={dispatchType === type ? "default" : "outline"}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => {
                    const currentDefault = getDefaultRecordLevelForType(dispatchType);
                    const nextDefault = getDefaultRecordLevelForType(type);
                    setDispatchType(type);
                    setRecordLevel((prev) =>
                      prev === currentDefault ? nextDefault : prev
                    );
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{tc(labelKey)}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {t("deviceConnection")} <span className="text-destructive">*</span>
            </Label>
            {loadingConnections ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loadingConnections")}
              </div>
            ) : (
              <Select
                value={connectionName}
                onValueChange={setConnectionName}
                disabled={!agentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={agentId ? t("selectDeviceConnection") : t("selectAgentFirst")} />
                </SelectTrigger>
                <SelectContent>
                  {connections.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {agentId ? t("noAvailableConnections") : t("selectAgentFirst")}
                    </div>
                  ) : (
                    connections.map((conn) => (
                      <SelectItem key={conn.name} value={conn.name}>
                        {conn.name}
                        {conn.host ? ` (${conn.host})` : ""}
                        {conn.device_profile ? ` [${conn.device_profile}]` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Shared options */}
          <div className="flex items-center gap-6">
            {dispatchType !== "exec" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="dry-run"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                />
                <Label htmlFor="dry-run" className="text-sm cursor-pointer">
                  Dry Run
                </Label>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t("recordLevelLabel")}</Label>
                {shouldHighlightRecording && (
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    {t("recordLevelRecommended")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={recordLevel}
                  onValueChange={(v) => setRecordLevel(v as "Off" | "KeyEventsOnly" | "Full")}
                >
                  <SelectTrigger className="w-[170px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Off">{t("recordLevelOff")}</SelectItem>
                    <SelectItem value="KeyEventsOnly">{t("recordLevelKeyEvents")}</SelectItem>
                    <SelectItem value="Full">{t("recordLevelFull")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                {shouldHighlightRecording
                  ? t("recordLevelTxDescription")
                  : t("recordLevelBasicDescription")}
              </p>
            </div>
          </div>

          {/* Type-specific form */}
          <div className="border-t pt-4">
            {dispatchType === "exec" && (
              <ExecForm value={execData} onChange={setExecData} />
            )}
            {dispatchType === "template" && (
              <TemplateForm
                value={templateData}
                onChange={setTemplateData}
                agentId={agentId}
              />
            )}
            {dispatchType === "tx_block" && (
              <TxBlockForm value={txBlockData} onChange={setTxBlockData} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); resetForm(); }}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {t("submitTask")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
