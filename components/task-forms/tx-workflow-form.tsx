"use client";

import { useState } from "react";
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

interface WorkflowStep {
  command: string;
  rollback: string;
}

interface WorkflowBlock {
  name: string;
  steps: WorkflowStep[];
}

export interface TxWorkflowFormData {
  blocks: WorkflowBlock[];
  mode: "enable" | "config";
  rawJson: string;
  useRawJson: boolean;
}

interface TxWorkflowFormProps {
  value: TxWorkflowFormData;
  onChange: (data: TxWorkflowFormData) => void;
}

export function TxWorkflowForm({ value, onChange }: TxWorkflowFormProps) {
  const t = useTranslations("taskForms");
  const tc = useTranslations("common");

  const toggleMode = () => {
    if (value.useRawJson) {
      try {
        const parsed = JSON.parse(value.rawJson);
        if (parsed.blocks && Array.isArray(parsed.blocks)) {
          onChange({
            ...value,
            blocks: parsed.blocks.map((b: { name?: string; steps?: Array<{ command?: string; rollback?: string }> }) => ({
              name: b.name || "",
              steps: (b.steps || []).map((s: { command?: string; rollback?: string }) => ({
                command: s.command || "",
                rollback: s.rollback || "",
              })),
            })),
            useRawJson: false,
          });
          return;
        }
      } catch {
        // Parse failed, just switch
      }
      onChange({ ...value, useRawJson: false });
    } else {
      const workflow = {
        blocks: value.blocks.map((b) => ({
          name: b.name,
          steps: b.steps.map((s) => ({
            command: s.command,
            ...(s.rollback ? { rollback: s.rollback } : {}),
          })),
        })),
      };
      onChange({
        ...value,
        rawJson: JSON.stringify(workflow, null, 2),
        useRawJson: true,
      });
    }
  };

  const addBlock = () => {
    onChange({
      ...value,
      blocks: [
        ...value.blocks,
        { name: "", steps: [{ command: "", rollback: "" }] },
      ],
    });
  };

  const removeBlock = (index: number) => {
    onChange({
      ...value,
      blocks: value.blocks.filter((_, i) => i !== index),
    });
  };

  const updateBlockName = (index: number, name: string) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b, i) =>
        i === index ? { ...b, name } : b
      ),
    });
  };

  const addStep = (blockIndex: number) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b, i) =>
        i === blockIndex
          ? { ...b, steps: [...b.steps, { command: "", rollback: "" }] }
          : b
      ),
    });
  };

  const removeStep = (blockIndex: number, stepIndex: number) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b, i) =>
        i === blockIndex
          ? { ...b, steps: b.steps.filter((_, j) => j !== stepIndex) }
          : b
      ),
    });
  };

  const updateStep = (
    blockIndex: number,
    stepIndex: number,
    field: "command" | "rollback",
    val: string
  ) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              steps: b.steps.map((s, j) =>
                j === stepIndex ? { ...s, [field]: val } : s
              ),
            }
          : b
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("workflowDefinition")}</Label>
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
            placeholder='{"blocks": [{"name": "block1", "steps": [{"command": "..."}]}]}'
            value={value.rawJson}
            onChange={(e) => onChange({ ...value, rawJson: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {t("workflowJsonHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {value.blocks.map((block, bi) => (
            <div
              key={bi}
              className="rounded-md border p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Block {bi + 1}
                  </span>
                  <Input
                    placeholder={t("blockNamePlaceholder")}
                    value={block.name}
                    onChange={(e) => updateBlockName(bi, e.target.value)}
                    className="text-sm h-7"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addStep(bi)}
                    className="h-6 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("step")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(bi)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {block.steps.map((step, si) => (
                <div key={si} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("commandLabel")}</Label>
                    <Input
                      placeholder={t("commandLabel")}
                      value={step.command}
                      onChange={(e) => updateStep(bi, si, "command", e.target.value)}
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("rollback")}</Label>
                    <Input
                      placeholder={t("rollbackCommandPlaceholder")}
                      value={step.rollback}
                      onChange={(e) => updateStep(bi, si, "rollback", e.target.value)}
                      className="text-sm h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(bi, si)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBlock}
            className="w-full"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("addBlock")}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="txworkflow-mode">{tc("executionMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as "enable" | "config" })}
        >
          <SelectTrigger id="txworkflow-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enable">{tc("enableMode")}</SelectItem>
            <SelectItem value="config">{tc("configMode")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function buildTxWorkflowPayload(data: TxWorkflowFormData): Record<string, unknown> {
  if (data.useRawJson) {
    try {
      return { workflow: JSON.parse(data.rawJson), mode: data.mode };
    } catch {
      return { workflow: {}, mode: data.mode };
    }
  }

  return {
    workflow: {
      blocks: data.blocks.map((b) => ({
        name: b.name,
        steps: b.steps.map((s) => ({
          command: s.command,
          ...(s.rollback ? { rollback: s.rollback } : {}),
        })),
      })),
    },
    mode: data.mode,
  };
}

export function validateTxWorkflowForm(data: TxWorkflowFormData, t: (key: string, params?: Record<string, string | number | Date>) => string): string | null {
  if (data.useRawJson) {
    if (!data.rawJson.trim()) return t("enterWorkflowJson");
    try {
      const parsed = JSON.parse(data.rawJson);
      if (!parsed.blocks) return t("jsonMustContainBlocks");
    } catch {
      return t("invalidJson");
    }
    return null;
  }

  if (data.blocks.length === 0) return t("addAtLeastOneBlock");
  for (let i = 0; i < data.blocks.length; i++) {
    const b = data.blocks[i];
    if (!b.name.trim()) return t("blockNameEmpty", { number: i + 1 });
    if (b.steps.length === 0) return t("blockNeedsStep", { number: i + 1 });
    for (let j = 0; j < b.steps.length; j++) {
      if (!b.steps[j].command.trim())
        return t("blockStepCommandEmpty", { blockNumber: i + 1, stepNumber: j + 1 });
    }
  }
  return null;
}

export const defaultTxWorkflowFormData: TxWorkflowFormData = {
  blocks: [{ name: "", steps: [{ command: "", rollback: "" }] }],
  mode: "config",
  rawJson: "",
  useRawJson: false,
};
