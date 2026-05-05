"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileCode,
  Loader2,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import type {
  AgentTemplateKind,
  AgentTemplateMeta,
  ManagerTemplate,
} from "@/lib/types";
import { formatAgentReportMode, isAgentAvailableStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const TEMPLATE_KINDS: AgentTemplateKind[] = [
  "template",
  "tx_block",
  "tx_workflow",
  "orchestrate",
];

function defaultContent(kind: AgentTemplateKind): string {
  if (kind === "template") {
    return "interface {{ interface }}\n description {{ description }}";
  }
  if (kind === "tx_block") {
    return JSON.stringify(
      {
        name: "example-block",
        fail_fast: true,
        steps: [
          {
            run: {
              kind: "command",
              mode: "Config",
              command: "interface {{ interface }}",
            },
            rollback: null,
            rollback_on_failure: false,
          },
        ],
        rollback_policy: "per_step",
      },
      null,
      2,
    );
  }
  if (kind === "tx_workflow") {
    return JSON.stringify(
      {
        name: "example-workflow",
        blocks: [],
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      name: "example-plan",
      jobs: [],
    },
    null,
    2,
  );
}

function formatTimestamp(value: Date | string): string {
  return new Date(value).toLocaleString();
}

function formatAgentTemplateTimestamp(value: number): string {
  return value > 0 ? new Date(value).toLocaleString() : "";
}

function formatTemplateSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} KiB`;
}

export default function TemplatesPage() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [selectedKind, setSelectedKind] =
    useState<AgentTemplateKind>("template");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedManagerTemplateId, setSelectedManagerTemplateId] =
    useState("");
  const [selectedAgentTemplateName, setSelectedAgentTemplateName] =
    useState("");
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState(defaultContent("template"));

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const availableAgents = useMemo(
    () =>
      (agentsQuery.data?.data ?? []).filter((agent) =>
        isAgentAvailableStatus(agent.status),
      ),
    [agentsQuery.data?.data],
  );
  const effectiveAgentId = selectedAgentId || availableAgents[0]?.id || "";
  const selectedAgent =
    availableAgents.find((agent) => agent.id === effectiveAgentId) ??
    availableAgents[0];

  const managerTemplatesQuery = useQuery({
    queryKey: ["manager-templates", selectedKind],
    queryFn: () => apiClient.getManagerTemplates(selectedKind),
  });

  const managerTemplates = useMemo(
    () => managerTemplatesQuery.data?.data?.templates ?? [],
    [managerTemplatesQuery.data?.data?.templates],
  );
  const selectedManagerTemplate = managerTemplates.find(
    (template) => template.id === selectedManagerTemplateId,
  );

  const agentTemplatesQuery = useQuery({
    queryKey: ["agent-templates", selectedAgent?.id, selectedKind],
    queryFn: () => apiClient.getAgentTemplates(selectedAgent!.id, selectedKind),
    enabled: Boolean(selectedAgent?.id),
  });

  const agentTemplates = useMemo(
    () => agentTemplatesQuery.data?.data?.templates ?? [],
    [agentTemplatesQuery.data?.data?.templates],
  );
  const effectiveAgentTemplateName = agentTemplates.some(
    (template) => template.name === selectedAgentTemplateName,
  )
    ? selectedAgentTemplateName
    : (agentTemplates[0]?.name ?? "");
  const selectedAgentTemplate = agentTemplates.find(
    (template) => template.name === effectiveAgentTemplateName,
  );

  const saveManagerMutation = useMutation({
    mutationFn: () =>
      apiClient.saveManagerTemplate({
        kind: selectedKind,
        name: draftName,
        content: draftContent,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? t("saveManagerFailed"));
        return;
      }
      toast.success(t("saveManagerSuccess"));
      const template = result.data?.template;
      if (template) {
        setSelectedManagerTemplateId(template.id);
      }
      queryClient.invalidateQueries({
        queryKey: ["manager-templates", selectedKind],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const syncFromAgentMutation = useMutation({
    mutationFn: (template?: AgentTemplateMeta) => {
      if (!selectedAgent) {
        throw new Error(t("selectAgentFirst"));
      }
      return apiClient.syncTemplatesFromAgent({
        agentId: selectedAgent.id,
        kind: selectedKind,
        names: template ? [template.name] : undefined,
      });
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? t("syncFromAgentFailed"));
        return;
      }
      toast.success(
        t("syncFromAgentSuccess", { count: result.data?.count ?? 0 }),
      );
      queryClient.invalidateQueries({
        queryKey: ["manager-templates", selectedKind],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const pushToAgentMutation = useMutation({
    mutationFn: (template: ManagerTemplate) => {
      if (!selectedAgent) {
        throw new Error(t("selectAgentFirst"));
      }
      return apiClient.pushManagerTemplateToAgent(
        template.id,
        selectedAgent.id,
      );
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error ?? t("pushToAgentFailed"));
        return;
      }
      toast.success(t("pushToAgentSuccess"));
      queryClient.invalidateQueries({
        queryKey: ["agent-templates", selectedAgent?.id, selectedKind],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleKindChange = (kind: AgentTemplateKind) => {
    setSelectedKind(kind);
    setSelectedManagerTemplateId("");
    setSelectedAgentTemplateName("");
    setDraftName("");
    setDraftContent(defaultContent(kind));
  };

  const loadManagerTemplateIntoEditor = (template: ManagerTemplate) => {
    setDraftName(template.name);
    setDraftContent(template.content);
    setSelectedManagerTemplateId(template.id);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 animate-fade-in md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("librarySubtitle")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hover-scale"
            onClick={() => {
              managerTemplatesQuery.refetch();
              agentTemplatesQuery.refetch();
            }}
            disabled={
              managerTemplatesQuery.isFetching || agentTemplatesQuery.isFetching
            }
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                managerTemplatesQuery.isFetching ||
                agentTemplatesQuery.isFetching
                  ? "animate-spin"
                  : ""
              }`}
            />
            {tc("refresh")}
          </Button>
        </div>

        <Card className="animate-fade-in stagger-1">
          <CardHeader className="pb-4">
            <CardTitle>{t("libraryControlsTitle")}</CardTitle>
            <CardDescription>{t("libraryControlsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              aria-label={t("kindCardTitle")}
              className="grid gap-2 rounded-xl border bg-muted/40 p-2 md:grid-cols-4"
            >
              {TEMPLATE_KINDS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  aria-pressed={selectedKind === kind}
                  variant={selectedKind === kind ? "default" : "ghost"}
                  className="justify-start md:justify-center"
                  onClick={() => handleKindChange(kind)}
                >
                  {t(`kind.${kind}`)}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="space-y-2">
                <Label>{t("currentTemplateType")}</Label>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-lg font-semibold">
                    {t(`kind.${selectedKind}`)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("activeKindDescription", {
                      kind: t(`kind.${selectedKind}`),
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("agentCardTitle")}</Label>
                <Select
                  value={effectiveAgentId}
                  onValueChange={(agentId) => {
                    setSelectedAgentId(agentId);
                    setSelectedAgentTemplateName("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectAgentPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} · {formatAgentReportMode(agent.reportMode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {selectedAgent.host}:{selectedAgent.port}
                    </Badge>
                    <Badge variant="secondary">
                      {formatAgentReportMode(selectedAgent.reportMode)}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {agentsQuery.isLoading
                      ? t("loadingAgents")
                      : t("noOnlineAgents")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5" />
                      {t("managerLibraryTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("managerLibraryDescription", {
                        kind: t(`kind.${selectedKind}`),
                      })}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedManagerTemplateId("");
                      setDraftName("");
                      setDraftContent(defaultContent(selectedKind));
                    }}
                  >
                    {t("newTemplate")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {managerTemplatesQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                ) : managerTemplates.length > 0 ? (
                  <div className="max-h-112 space-y-2 overflow-y-auto pr-1">
                    {managerTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-secondary ${
                          selectedManagerTemplateId === template.id
                            ? "border-primary bg-secondary"
                            : "border-border"
                        }`}
                        onClick={() => loadManagerTemplateIntoEditor(template)}
                      >
                        <div className="font-medium text-sm">
                          {template.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {template.sourceAgentName
                            ? t("syncedFrom", {
                                agent: template.sourceAgentName,
                              })
                            : t("localOnly")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatTimestamp(template.updatedAt)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t("emptyManagerLibrary")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("agentLibraryTitle")}</CardTitle>
                <CardDescription>{t("syncAgentDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => syncFromAgentMutation.mutate(undefined)}
                  disabled={
                    syncFromAgentMutation.isPending ||
                    !selectedAgent ||
                    agentTemplates.length === 0
                  }
                >
                  {syncFromAgentMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("syncAllFromAgent")}
                </Button>

                {agentTemplatesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                ) : agentTemplates.length > 0 ? (
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {agentTemplates.map((template) => (
                      <div
                        key={template.name}
                        className={`rounded-lg border p-3 transition-colors ${
                          effectiveAgentTemplateName === template.name
                            ? "border-primary bg-secondary"
                            : "border-border"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() =>
                            setSelectedAgentTemplateName(template.name)
                          }
                        >
                          <div className="font-medium text-sm">
                            {template.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {template.source ? (
                              <Badge variant="outline">{template.source}</Badge>
                            ) : null}
                            {template.contentType ? (
                              <Badge variant="outline">
                                {template.contentType}
                              </Badge>
                            ) : null}
                            {formatTemplateSize(template.sizeBytes) ? (
                              <Badge variant="outline">
                                {formatTemplateSize(template.sizeBytes)}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatAgentTemplateTimestamp(
                              template.updatedAtMs,
                            ) || t("metadataUnavailable")}
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => syncFromAgentMutation.mutate(template)}
                          disabled={syncFromAgentMutation.isPending}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {t("syncOneFromAgent")}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {selectedAgent
                      ? t("emptyAgentLibrary")
                      : t("selectAgentFirst")}
                  </div>
                )}
                {selectedAgentTemplate ? (
                  <p className="text-xs text-muted-foreground">
                    {t("selectedAgentTemplate", {
                      name: selectedAgentTemplate.name,
                    })}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-150">
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>{t("editorTitle")}</CardTitle>
                  <CardDescription>{t("editorDescription")}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => saveManagerMutation.mutate()}
                    disabled={
                      saveManagerMutation.isPending ||
                      !draftName.trim() ||
                      !draftContent.trim()
                    }
                  >
                    {saveManagerMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t("saveToManager")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      selectedManagerTemplate &&
                      pushToAgentMutation.mutate(selectedManagerTemplate)
                    }
                    disabled={
                      pushToAgentMutation.isPending ||
                      !selectedAgent ||
                      !selectedManagerTemplate
                    }
                  >
                    {pushToAgentMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {t("pushToAgent")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedManagerTemplate ? (
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedManagerTemplate.name}</Badge>
                  {selectedManagerTemplate.sourceAgentName ? (
                    <Badge variant="outline">
                      {t("syncedFrom", {
                        agent: selectedManagerTemplate.sourceAgentName,
                      })}
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("newTemplateHint")}
                </div>
              )}
              <div className="grid gap-4 xl:grid-cols-[minmax(220px,320px)_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="template-name">{t("templateName")}</Label>
                  <Input
                    id="template-name"
                    placeholder={t("templateNamePlaceholder")}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("currentTemplateType")}</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                    {t(`kind.${selectedKind}`)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-content">{t("templateContent")}</Label>
                <Textarea
                  id="template-content"
                  className="min-h-115 font-mono text-sm"
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
