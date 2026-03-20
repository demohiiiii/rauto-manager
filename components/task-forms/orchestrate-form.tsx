"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Code, FormInput } from "lucide-react";
import { useTranslations } from "next-intl";

type StageStrategy = "serial" | "parallel";
type OrchestrationActionKind = "tx_block" | "tx_workflow";

export interface OrchestrateStageFormData {
  name: string;
  strategy: StageStrategy;
  maxParallel: string;
  failFast: boolean;
  targetGroups: string;
  targetsJson: string;
  actionKind: OrchestrationActionKind;
  actionJson: string;
}

export interface OrchestrateFormData {
  name: string;
  failFast: boolean;
  inventoryFile: string;
  inventoryJson: string;
  baseDir: string;
  stages: OrchestrateStageFormData[];
  rawJson: string;
  useRawJson: boolean;
}

interface OrchestrateFormProps {
  value: OrchestrateFormData;
  onChange: (data: OrchestrateFormData) => void;
}

function defaultActionJson(kind: OrchestrationActionKind): string {
  if (kind === "tx_workflow") {
    return JSON.stringify(
      {
        workflow_file: "./core-vlan-workflow.json",
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      name: "stage-change",
      mode: "Config",
      commands: ["show version"],
    },
    null,
    2
  );
}

function defaultStage(): OrchestrateStageFormData {
  return {
    name: "",
    strategy: "serial",
    maxParallel: "",
    failFast: true,
    targetGroups: "",
    targetsJson: "",
    actionKind: "tx_block",
    actionJson: defaultActionJson("tx_block"),
  };
}

function parseOptionalPositiveInt(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePlanFromJson(rawJson: string): Partial<OrchestrateFormData> | null {
  try {
    const parsed = JSON.parse(rawJson) as {
      name?: string;
      fail_fast?: boolean;
      inventory_file?: string;
      inventory?: unknown;
      stages?: Array<{
        name?: string;
        strategy?: string;
        max_parallel?: number;
        fail_fast?: boolean;
        target_groups?: string[];
        targets?: unknown;
        action?: {
          kind?: string;
          [key: string]: unknown;
        };
      }>;
    };

    if (!Array.isArray(parsed.stages)) {
      return null;
    }

    return {
      name: parsed.name ?? "",
      failFast: parsed.fail_fast ?? true,
      inventoryFile: parsed.inventory_file ?? "",
      inventoryJson: parsed.inventory
        ? JSON.stringify(parsed.inventory, null, 2)
        : "",
      stages: parsed.stages.map((stage) => {
        const action = stage.action ?? {};
        const actionKind =
          action.kind === "tx_workflow" ? "tx_workflow" : "tx_block";
        const { kind: _kind, ...actionPayload } = action;

        return {
          name: stage.name ?? "",
          strategy: stage.strategy === "parallel" ? "parallel" : "serial",
          maxParallel:
            stage.max_parallel !== undefined ? String(stage.max_parallel) : "",
          failFast: stage.fail_fast ?? true,
          targetGroups: Array.isArray(stage.target_groups)
            ? stage.target_groups.join(", ")
            : "",
          targetsJson: stage.targets
            ? JSON.stringify(stage.targets, null, 2)
            : "",
          actionKind,
          actionJson: JSON.stringify(actionPayload, null, 2),
        };
      }),
    };
  } catch {
    return null;
  }
}

function buildPlanJson(data: OrchestrateFormData): Record<string, unknown> {
  const plan: Record<string, unknown> = {
    name: data.name.trim(),
    fail_fast: data.failFast,
    stages: data.stages.map((stage) => {
      const actionPayload = JSON.parse(stage.actionJson) as Record<string, unknown>;
      const targets = stage.targetsJson.trim()
        ? (JSON.parse(stage.targetsJson) as unknown[])
        : undefined;
      const targetGroups = stage.targetGroups
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const maxParallel = parseOptionalPositiveInt(stage.maxParallel);

      return {
        name: stage.name.trim(),
        strategy: stage.strategy,
        ...(maxParallel !== undefined ? { max_parallel: maxParallel } : {}),
        fail_fast: stage.failFast,
        ...(targetGroups.length > 0 ? { target_groups: targetGroups } : {}),
        ...(targets ? { targets } : {}),
        action: {
          kind: stage.actionKind,
          ...actionPayload,
        },
      };
    }),
  };

  if (data.inventoryFile.trim()) {
    plan.inventory_file = data.inventoryFile.trim();
  }

  if (data.inventoryJson.trim()) {
    plan.inventory = JSON.parse(data.inventoryJson);
  }

  return plan;
}

export function OrchestrateForm({ value, onChange }: OrchestrateFormProps) {
  const t = useTranslations("taskForms");

  const toggleMode = () => {
    if (value.useRawJson) {
      const parsed = parsePlanFromJson(value.rawJson);
      if (!parsed) {
        return;
      }
      onChange({
        ...value,
        ...parsed,
        useRawJson: false,
      });
      return;
    }

    try {
      onChange({
        ...value,
        rawJson: JSON.stringify(buildPlanJson(value), null, 2),
        useRawJson: true,
      });
    } catch {
      return;
    }
  };

  const addStage = () => {
    onChange({
      ...value,
      stages: [...value.stages, defaultStage()],
    });
  };

  const removeStage = (index: number) => {
    onChange({
      ...value,
      stages: value.stages.filter((_, i) => i !== index),
    });
  };

  const updateStage = (index: number, patch: Partial<OrchestrateStageFormData>) => {
    onChange({
      ...value,
      stages: value.stages.map((stage, i) =>
        i === index ? { ...stage, ...patch } : stage
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t("orchestratePlan")}</Label>
          <p className="text-xs text-muted-foreground">
            {value.useRawJson ? t("orchestrateJsonHint") : t("actionJsonHint")}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleMode}>
          {value.useRawJson ? (
            <>
              <FormInput className="mr-1 h-3 w-3" />
              {t("structuredEdit")}
            </>
          ) : (
            <>
              <Code className="mr-1 h-3 w-3" />
              {t("jsonEdit")}
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="orchestrate-base-dir">{t("baseDir")}</Label>
        <Input
          id="orchestrate-base-dir"
          placeholder={t("baseDirPlaceholder")}
          value={value.baseDir}
          onChange={(e) => onChange({ ...value, baseDir: e.target.value })}
        />
      </div>

      {value.useRawJson ? (
        <div className="space-y-2">
          <Textarea
            className="min-h-[360px] font-mono text-sm"
            placeholder={t("orchestrateJsonPlaceholder")}
            value={value.rawJson}
            onChange={(e) => onChange({ ...value, rawJson: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {t("orchestrateJsonHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orchestrate-name">
                {t("planNameLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="orchestrate-name"
                placeholder={t("planNamePlaceholder")}
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orchestrate-inventory-file">
                {t("inventoryFile")}
              </Label>
              <Input
                id="orchestrate-inventory-file"
                placeholder={t("inventoryFilePlaceholder")}
                value={value.inventoryFile}
                onChange={(e) =>
                  onChange({ ...value, inventoryFile: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div className="space-y-0.5">
              <Label>{t("planFailFast")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("planFailFastHint")}
              </p>
            </div>
            <Switch
              checked={value.failFast}
              onCheckedChange={(checked) =>
                onChange({ ...value, failFast: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orchestrate-inventory-json">{t("inventoryJson")}</Label>
            <Textarea
              id="orchestrate-inventory-json"
              className="min-h-[140px] font-mono text-sm"
              placeholder={t("inventoryJsonPlaceholder")}
              value={value.inventoryJson}
              onChange={(e) =>
                onChange({ ...value, inventoryJson: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("inventoryJsonHint")}
            </p>
          </div>

          <div className="space-y-3">
            {value.stages.map((stage, index) => (
              <div key={index} className="space-y-4 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("stageNumber", { number: index + 1 })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStage(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("stageName")}</Label>
                    <Input
                      placeholder={t("stageNamePlaceholder")}
                      value={stage.name}
                      onChange={(e) =>
                        updateStage(index, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("executionStrategy")}</Label>
                    <Select
                      value={stage.strategy}
                      onValueChange={(next) =>
                        updateStage(index, {
                          strategy: next as StageStrategy,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serial">
                          {t("strategySerial")}
                        </SelectItem>
                        <SelectItem value="parallel">
                          {t("strategyParallel")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("maxParallel")}</Label>
                    <Input
                      inputMode="numeric"
                      placeholder={t("maxParallelPlaceholder")}
                      value={stage.maxParallel}
                      onChange={(e) =>
                        updateStage(index, { maxParallel: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-4 py-3">
                    <div className="space-y-0.5">
                      <Label>{t("stageFailFast")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("stageFailFastHint")}
                      </p>
                    </div>
                    <Switch
                      checked={stage.failFast}
                      onCheckedChange={(checked) =>
                        updateStage(index, { failFast: checked })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("targetGroups")}</Label>
                  <Input
                    placeholder={t("targetGroupsPlaceholder")}
                    value={stage.targetGroups}
                    onChange={(e) =>
                      updateStage(index, { targetGroups: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("targetsJson")}</Label>
                  <Textarea
                    className="min-h-[120px] font-mono text-sm"
                    placeholder={t("targetsJsonPlaceholder")}
                    value={stage.targetsJson}
                    onChange={(e) =>
                      updateStage(index, { targetsJson: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("targetsJsonHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("actionKind")}</Label>
                  <Select
                    value={stage.actionKind}
                    onValueChange={(next) =>
                      updateStage(index, {
                        actionKind: next as OrchestrationActionKind,
                        actionJson: defaultActionJson(
                          next as OrchestrationActionKind
                        ),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tx_block">
                        {t("actionKindTxBlock")}
                      </SelectItem>
                      <SelectItem value="tx_workflow">
                        {t("actionKindTxWorkflow")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("actionJson")}</Label>
                  <Textarea
                    className="min-h-[180px] font-mono text-sm"
                    placeholder={t("actionJsonPlaceholder")}
                    value={stage.actionJson}
                    onChange={(e) =>
                      updateStage(index, { actionJson: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("actionJsonHint")}
                  </p>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStage}
              className="w-full"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t("addStage")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function buildOrchestratePayload(data: OrchestrateFormData): Record<string, unknown> {
  const plan = data.useRawJson
    ? (() => {
        try {
          return JSON.parse(data.rawJson);
        } catch {
          return {};
        }
      })()
    : buildPlanJson(data);

  return {
    plan,
    ...(data.baseDir.trim() ? { base_dir: data.baseDir.trim() } : {}),
  };
}

export function validateOrchestrateForm(
  data: OrchestrateFormData,
  t: (key: string, params?: Record<string, string | number | Date>) => string
): string | null {
  if (data.useRawJson) {
    if (!data.rawJson.trim()) {
      return t("enterOrchestratePlanJson");
    }

    try {
      const parsed = JSON.parse(data.rawJson) as { stages?: unknown };
      if (!Array.isArray(parsed.stages)) {
        return t("jsonMustContainStages");
      }
    } catch {
      return t("invalidJson");
    }

    return null;
  }

  if (!data.name.trim()) {
    return t("planNameRequired");
  }

  if (data.inventoryJson.trim()) {
    try {
      const parsed = JSON.parse(data.inventoryJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return t("invalidInventoryJson");
      }
    } catch {
      return t("invalidInventoryJson");
    }
  }

  if (data.stages.length === 0) {
    return t("addAtLeastOneStage");
  }

  for (let i = 0; i < data.stages.length; i += 1) {
    const stage = data.stages[i];

    if (!stage.name.trim()) {
      return t("stageNameEmpty", { number: i + 1 });
    }

    if (!stage.targetGroups.trim() && !stage.targetsJson.trim()) {
      return t("stageNeedsTargetSelector", { number: i + 1 });
    }

    if (
      stage.maxParallel.trim() &&
      parseOptionalPositiveInt(stage.maxParallel) === undefined
    ) {
      return t("positiveIntegerRequired");
    }

    if (stage.targetsJson.trim()) {
      try {
        const parsed = JSON.parse(stage.targetsJson);
        if (!Array.isArray(parsed)) {
          return t("invalidTargetsJson");
        }
      } catch {
        return t("invalidTargetsJson");
      }
    }

    if (!stage.actionJson.trim()) {
      return t("actionJsonRequired", { number: i + 1 });
    }

    try {
      const parsed = JSON.parse(stage.actionJson) as Record<string, unknown>;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return t("invalidActionJson", { number: i + 1 });
      }

      if (stage.actionKind === "tx_block") {
        const hasTemplate = hasNonEmptyString(parsed.template);
        const hasCommands =
          Array.isArray(parsed.commands) &&
          parsed.commands.some((item) => hasNonEmptyString(item));

        if (!hasTemplate && !hasCommands) {
          return t("orchestrateTxBlockActionNeedsCommandsOrTemplate", {
            number: i + 1,
          });
        }

        if (
          parsed.rollback_trigger_step_index !== undefined &&
          parsed.rollback_trigger_step_index !== null &&
          !hasNonEmptyString(parsed.resource_rollback_command)
        ) {
          return t("txBlockRollbackTriggerRequiresResourceRollback");
        }
      }

      if (stage.actionKind === "tx_workflow") {
        const hasWorkflowFile = hasNonEmptyString(parsed.workflow_file);
        const hasWorkflow =
          Object.prototype.hasOwnProperty.call(parsed, "workflow") &&
          parsed.workflow !== null &&
          parsed.workflow !== undefined;

        if (hasWorkflowFile === hasWorkflow) {
          return t("orchestrateWorkflowActionRequiresExactlyOneSource", {
            number: i + 1,
          });
        }
      }
    } catch {
      return t("invalidActionJson", { number: i + 1 });
    }
  }

  return null;
}

export const defaultOrchestrateFormData: OrchestrateFormData = {
  name: "",
  failFast: true,
  inventoryFile: "",
  inventoryJson: "",
  baseDir: "",
  stages: [defaultStage()],
  rawJson: "",
  useRawJson: false,
};
