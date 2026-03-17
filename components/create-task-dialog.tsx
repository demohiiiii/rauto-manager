"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap, Terminal, FileCode, Layers, Network, GitBranch } from "lucide-react";
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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api/client";
import type { DispatchType } from "@/lib/types";

import { ExecForm, buildExecPayload, validateExecForm, defaultExecFormData, type ExecFormData } from "@/components/task-forms/exec-form";
import { TemplateForm, buildTemplatePayload, validateTemplateForm, defaultTemplateFormData, type TemplateFormData } from "@/components/task-forms/template-form";
import { TxBlockForm, buildTxBlockPayload, validateTxBlockForm, defaultTxBlockFormData, type TxBlockFormData } from "@/components/task-forms/tx-block-form";
import { TxWorkflowForm, buildTxWorkflowPayload, validateTxWorkflowForm, defaultTxWorkflowFormData, type TxWorkflowFormData } from "@/components/task-forms/tx-workflow-form";
import { OrchestrateForm, buildOrchestratePayload, validateOrchestrateForm, defaultOrchestrateFormData, type OrchestrateFormData } from "@/components/task-forms/orchestrate-form";

const DISPATCH_TYPE_CONFIG: {
  type: DispatchType;
  labelKey: string;
  icon: typeof Terminal;
}[] = [
  { type: "exec", labelKey: "singleCommand", icon: Terminal },
  { type: "template", labelKey: "template", icon: FileCode },
  { type: "tx_block", labelKey: "txBlock", icon: Layers },
  { type: "tx_workflow", labelKey: "workflow", icon: GitBranch },
  { type: "orchestrate", labelKey: "orchestrate", icon: Network },
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
  const [dispatchType, setDispatchType] = useState<DispatchType>("exec");
  const [connectionName, setConnectionName] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [recordLevel, setRecordLevel] = useState<"Off" | "KeyEventsOnly" | "Full">("Off");

  // 表单数据
  const [execData, setExecData] = useState<ExecFormData>(defaultExecFormData);
  const [templateData, setTemplateData] = useState<TemplateFormData>(defaultTemplateFormData);
  const [txBlockData, setTxBlockData] = useState<TxBlockFormData>(defaultTxBlockFormData);
  const [txWorkflowData, setTxWorkflowData] = useState<TxWorkflowFormData>(defaultTxWorkflowFormData);
  const [orchestrateData, setOrchestrateData] = useState<OrchestrateFormData>(defaultOrchestrateFormData);

  // 连接列表
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  const queryClient = useQueryClient();

  // 获取在线 Agent 列表
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const onlineAgents = (agentsData?.data ?? []).filter(
    (a) => a.status === "online"
  );

  // 当选中 Agent 变更时，获取连接列表
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

  // 重置表单
  const resetForm = () => {
    setAgentId("");
    setDispatchType("exec");
    setConnectionName("");
    setDryRun(false);
    setRecordLevel("Off");
    setExecData(defaultExecFormData);
    setTemplateData(defaultTemplateFormData);
    setTxBlockData(defaultTxBlockFormData);
    setTxWorkflowData(defaultTxWorkflowFormData);
    setOrchestrateData(defaultOrchestrateFormData);
  };

  // 验证表单
  const validateForm = (): string | null => {
    if (!agentId) return t("selectAgent");
    if (dispatchType !== "orchestrate" && !connectionName) return t("selectConnection");

    switch (dispatchType) {
      case "exec":
        return validateExecForm(execData, tf);
      case "template":
        return validateTemplateForm(templateData, tf);
      case "tx_block":
        return validateTxBlockForm(txBlockData, tf);
      case "tx_workflow":
        return validateTxWorkflowForm(txWorkflowData, tf);
      case "orchestrate":
        return validateOrchestrateForm(orchestrateData, tf);
      default:
        return null;
    }
  };

  // 构建 payload
  const buildPayload = (): Record<string, unknown> => {
    switch (dispatchType) {
      case "exec":
        return buildExecPayload(execData);
      case "template":
        return buildTemplatePayload(templateData);
      case "tx_block":
        return buildTxBlockPayload(txBlockData);
      case "tx_workflow":
        return buildTxWorkflowPayload(txWorkflowData);
      case "orchestrate":
        return buildOrchestratePayload(orchestrateData);
      default:
        return {};
    }
  };

  // 提交
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const payload = buildPayload();

      // 构建连接信息
      const connection =
        dispatchType !== "orchestrate" && connectionName
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
          {/* Agent 选择 */}
          <div className="space-y-2">
            <Label>
              {t("targetAgent")} <span className="text-destructive">*</span>
            </Label>
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); setConnectionName(""); }}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectOnlineAgent")} />
              </SelectTrigger>
              <SelectContent>
                {onlineAgents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">{t("noOnlineAgents")}</div>
                ) : (
                  onlineAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.host}:{agent.port})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 下发类型选择 */}
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
                  onClick={() => setDispatchType(type)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{tc(labelKey)}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 设备连接选择（orchestrate 不需要） */}
          {dispatchType !== "orchestrate" && (
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
          )}

          {/* 公共选项 */}
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
            <div className="flex items-center gap-2">
              <Label className="text-sm">Record Level</Label>
              <Select
                value={recordLevel}
                onValueChange={(v) => setRecordLevel(v as "Off" | "KeyEventsOnly" | "Full")}
              >
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Off">Off</SelectItem>
                  <SelectItem value="KeyEventsOnly">Key Events</SelectItem>
                  <SelectItem value="Full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 类型特定表单 */}
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
            {dispatchType === "tx_workflow" && (
              <TxWorkflowForm value={txWorkflowData} onChange={setTxWorkflowData} />
            )}
            {dispatchType === "orchestrate" && (
              <OrchestrateForm value={orchestrateData} onChange={setOrchestrateData} />
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
