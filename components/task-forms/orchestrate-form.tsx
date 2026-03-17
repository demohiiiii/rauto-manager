"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Code, FormInput } from "lucide-react";
import { useTranslations } from "next-intl";

interface OrchestrateStage {
  name: string;
  strategy: "parallel" | "serial" | "rolling";
  targets: string;
  action_type: "exec" | "template";
  action_command: string;
  action_template: string;
}

export interface OrchestrateFormData {
  stages: OrchestrateStage[];
  rawJson: string;
  useRawJson: boolean;
}

interface OrchestrateFormProps {
  value: OrchestrateFormData;
  onChange: (data: OrchestrateFormData) => void;
}

export function OrchestrateForm({ value, onChange }: OrchestrateFormProps) {
  const t = useTranslations("taskForms");

  const toggleMode = () => {
    if (value.useRawJson) {
      try {
        const parsed = JSON.parse(value.rawJson);
        if (parsed.stages && Array.isArray(parsed.stages)) {
          onChange({
            ...value,
            stages: parsed.stages.map((s: Record<string, unknown>) => ({
              name: (s.name as string) || "",
              strategy: (s.strategy as string) || "serial",
              targets: Array.isArray(s.targets) ? (s.targets as string[]).join(", ") : "",
              action_type: (s.action as Record<string, unknown>)?.command ? "exec" : "template",
              action_command: ((s.action as Record<string, unknown>)?.command as string) || "",
              action_template: ((s.action as Record<string, unknown>)?.template as string) || "",
            })),
            useRawJson: false,
          });
          return;
        }
      } catch {
        // Parse failed
      }
      onChange({ ...value, useRawJson: false });
    } else {
      const plan = {
        stages: value.stages.map((s) => ({
          name: s.name,
          strategy: s.strategy,
          targets: s.targets.split(",").map((t) => t.trim()).filter(Boolean),
          action:
            s.action_type === "exec"
              ? { command: s.action_command }
              : { template: s.action_template },
        })),
      };
      onChange({
        ...value,
        rawJson: JSON.stringify(plan, null, 2),
        useRawJson: true,
      });
    }
  };

  const addStage = () => {
    onChange({
      ...value,
      stages: [
        ...value.stages,
        {
          name: "",
          strategy: "serial",
          targets: "",
          action_type: "exec",
          action_command: "",
          action_template: "",
        },
      ],
    });
  };

  const removeStage = (index: number) => {
    onChange({
      ...value,
      stages: value.stages.filter((_, i) => i !== index),
    });
  };

  const updateStage = (index: number, field: string, val: string) => {
    onChange({
      ...value,
      stages: value.stages.map((s, i) =>
        i === index ? { ...s, [field]: val } : s
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("orchestratePlan")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleMode}
        >
          {value.useRawJson ? (
            <>
              <FormInput className="h-3 w-3 mr-1" />
              {t("structuredEdit")}
            </>
          ) : (
            <>
              <Code className="h-3 w-3 mr-1" />
              {t("jsonEdit")}
            </>
          )}
        </Button>
      </div>

      {value.useRawJson ? (
        <div className="space-y-2">
          <Textarea
            className="font-mono text-sm min-h-[300px]"
            placeholder='{"stages": [{"name": "stage1", "strategy": "serial", "targets": ["device1"], "action": {"command": "show version"}}]}'
            value={value.rawJson}
            onChange={(e) => onChange({ ...value, rawJson: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {t("orchestrateJsonHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {value.stages.map((stage, si) => (
            <div
              key={si}
              className="rounded-md border p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Stage {si + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStage(si)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("stageName")}</Label>
                  <Input
                    placeholder={t("stageNamePlaceholder")}
                    value={stage.name}
                    onChange={(e) => updateStage(si, "name", e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("executionStrategy")}</Label>
                  <Select
                    value={stage.strategy}
                    onValueChange={(v) => updateStage(si, "strategy", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serial">{t("strategySerial")}</SelectItem>
                      <SelectItem value="parallel">{t("strategyParallel")}</SelectItem>
                      <SelectItem value="rolling">{t("strategyRolling")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("targetDevices")}</Label>
                <Input
                  placeholder={t("targetDevicesPlaceholder")}
                  value={stage.targets}
                  onChange={(e) => updateStage(si, "targets", e.target.value)}
                  className="text-sm h-8"
                />
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">{t("actionType")}</Label>
                  <Select
                    value={stage.action_type}
                    onValueChange={(v) => updateStage(si, "action_type", v)}
                  >
                    <SelectTrigger className="h-8 text-sm w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exec">{t("actionCommand")}</SelectItem>
                      <SelectItem value="template">{t("actionTemplate")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {stage.action_type === "exec" ? t("actionCommand") : t("templateName")}
                  </Label>
                  <Input
                    placeholder={
                      stage.action_type === "exec"
                        ? "show version"
                        : "template-name"
                    }
                    value={
                      stage.action_type === "exec"
                        ? stage.action_command
                        : stage.action_template
                    }
                    onChange={(e) =>
                      updateStage(
                        si,
                        stage.action_type === "exec"
                          ? "action_command"
                          : "action_template",
                        e.target.value
                      )
                    }
                    className="text-sm h-8"
                  />
                </div>
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
            <Plus className="h-3 w-3 mr-1" />
            {t("addStage")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function buildOrchestratePayload(data: OrchestrateFormData): Record<string, unknown> {
  if (data.useRawJson) {
    try {
      return { plan: JSON.parse(data.rawJson) };
    } catch {
      return { plan: {} };
    }
  }

  return {
    plan: {
      stages: data.stages.map((s) => ({
        name: s.name,
        strategy: s.strategy,
        targets: s.targets.split(",").map((t) => t.trim()).filter(Boolean),
        action:
          s.action_type === "exec"
            ? { command: s.action_command }
            : { template: s.action_template },
      })),
    },
  };
}

export function validateOrchestrateForm(data: OrchestrateFormData, t: (key: string, params?: Record<string, string | number | Date>) => string): string | null {
  if (data.useRawJson) {
    if (!data.rawJson.trim()) return t("enterOrchestratePlanJson");
    try {
      const parsed = JSON.parse(data.rawJson);
      if (!parsed.stages) return t("jsonMustContainStages");
    } catch {
      return t("invalidJson");
    }
    return null;
  }

  if (data.stages.length === 0) return t("addAtLeastOneStage");
  for (let i = 0; i < data.stages.length; i++) {
    const s = data.stages[i];
    if (!s.name.trim()) return t("stageNameEmpty", { number: i + 1 });
    if (!s.targets.trim()) return t("stageTargetsEmpty", { number: i + 1 });
    if (s.action_type === "exec" && !s.action_command.trim())
      return t("stageCommandEmpty", { number: i + 1 });
    if (s.action_type === "template" && !s.action_template.trim())
      return t("stageTemplateEmpty", { number: i + 1 });
  }
  return null;
}

export const defaultOrchestrateFormData: OrchestrateFormData = {
  stages: [
    {
      name: "",
      strategy: "serial",
      targets: "",
      action_type: "exec",
      action_command: "",
      action_template: "",
    },
  ],
  rawJson: "",
  useRawJson: false,
};
