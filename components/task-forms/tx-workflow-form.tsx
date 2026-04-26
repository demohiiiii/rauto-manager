"use client";

import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

type TxMode = string;
type WorkflowBlockKind = "config" | "show";
type WorkflowRollbackPolicy = "per_step" | "none" | "whole_resource";

export interface TxWorkflowStepFormData {
  mode: TxMode;
  command: string;
  timeoutSecs: string;
  rollbackCommand: string;
  rollbackOnFailure: boolean;
}

export interface TxWorkflowBlockFormData {
  name: string;
  kind: WorkflowBlockKind;
  failFast: boolean;
  rollbackPolicy: WorkflowRollbackPolicy;
  wholeResourceMode: TxMode;
  wholeResourceUndoCommand: string;
  wholeResourceTimeoutSecs: string;
  wholeResourceTriggerStepIndex: string;
  steps: TxWorkflowStepFormData[];
}

export interface TxWorkflowFormData {
  name: string;
  failFast: boolean;
  blocks: TxWorkflowBlockFormData[];
  rawJson: string;
  useRawJson: boolean;
}

interface TxWorkflowFormProps {
  value: TxWorkflowFormData;
  onChange: (data: TxWorkflowFormData) => void;
}

function defaultWorkflowStep(): TxWorkflowStepFormData {
  return {
    mode: AUTO_PROFILE_MODE,
    command: "",
    timeoutSecs: "",
    rollbackCommand: "",
    rollbackOnFailure: false,
  };
}

function defaultWorkflowBlock(): TxWorkflowBlockFormData {
  return {
    name: "",
    kind: "config",
    failFast: true,
    rollbackPolicy: "per_step",
    wholeResourceMode: AUTO_PROFILE_MODE,
    wholeResourceUndoCommand: "",
    wholeResourceTimeoutSecs: "",
    wholeResourceTriggerStepIndex: "",
    steps: [defaultWorkflowStep()],
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

function parseOptionalNonNegativeInt(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function parseTxWorkflowPayloadToFormData(
  payload: unknown,
): TxWorkflowFormData {
  const normalizedPayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const workflow =
    normalizedPayload.workflow &&
    typeof normalizedPayload.workflow === "object" &&
    !Array.isArray(normalizedPayload.workflow)
      ? (normalizedPayload.workflow as Record<string, unknown>)
      : normalizedPayload;
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];

  return {
    name: typeof workflow.name === "string" ? workflow.name : "",
    failFast: workflow.fail_fast !== false,
    blocks:
      blocks.length > 0
        ? blocks.map((block) => {
            const normalizedBlock =
              block && typeof block === "object" && !Array.isArray(block)
                ? (block as Record<string, unknown>)
                : {};
            const wholeResource =
              typeof normalizedBlock.rollback_policy === "object" &&
              normalizedBlock.rollback_policy &&
              !Array.isArray(normalizedBlock.rollback_policy) &&
              "whole_resource" in normalizedBlock.rollback_policy
                ? ((
                    normalizedBlock.rollback_policy as {
                      whole_resource?: unknown;
                    }
                  ).whole_resource as Record<string, unknown> | undefined)
                : undefined;
            const steps = Array.isArray(normalizedBlock.steps)
              ? normalizedBlock.steps
              : [];

            return {
              name:
                typeof normalizedBlock.name === "string"
                  ? normalizedBlock.name
                  : "",
              kind: normalizedBlock.kind === "show" ? "show" : "config",
              failFast: normalizedBlock.fail_fast !== false,
              rollbackPolicy: wholeResource
                ? "whole_resource"
                : normalizedBlock.rollback_policy === "none"
                  ? "none"
                  : "per_step",
              wholeResourceMode:
                typeof wholeResource?.mode === "string"
                  ? wholeResource.mode
                  : AUTO_PROFILE_MODE,
              wholeResourceUndoCommand:
                typeof wholeResource?.undo_command === "string"
                  ? wholeResource.undo_command
                  : "",
              wholeResourceTimeoutSecs:
                typeof wholeResource?.timeout_secs === "number"
                  ? String(wholeResource.timeout_secs)
                  : "",
              wholeResourceTriggerStepIndex:
                typeof wholeResource?.trigger_step_index === "number"
                  ? String(wholeResource.trigger_step_index)
                  : "",
              steps:
                steps.length > 0
                  ? steps.map((step) => {
                      const normalizedStep =
                        step && typeof step === "object" && !Array.isArray(step)
                          ? (step as Record<string, unknown>)
                          : {};

                      return {
                        mode:
                          typeof normalizedStep.mode === "string"
                            ? normalizedStep.mode
                            : AUTO_PROFILE_MODE,
                        command:
                          typeof normalizedStep.command === "string"
                            ? normalizedStep.command
                            : "",
                        timeoutSecs:
                          typeof normalizedStep.timeout_secs === "number"
                            ? String(normalizedStep.timeout_secs)
                            : "",
                        rollbackCommand:
                          typeof normalizedStep.rollback_command === "string"
                            ? normalizedStep.rollback_command
                            : "",
                        rollbackOnFailure:
                          normalizedStep.rollback_on_failure === true,
                      };
                    })
                  : [defaultWorkflowStep()],
            };
          })
        : [defaultWorkflowBlock()],
    rawJson: "",
    useRawJson: false,
  };
}

export function TxWorkflowForm({ value, onChange }: TxWorkflowFormProps) {
  const t = useTranslations("taskForms");

  const addBlock = () => {
    onChange({
      ...value,
      blocks: [...value.blocks, defaultWorkflowBlock()],
    });
  };

  const removeBlock = (index: number) => {
    onChange({
      ...value,
      blocks: value.blocks.filter((_, i) => i !== index),
    });
  };

  const updateBlock = (
    index: number,
    patch: Partial<TxWorkflowBlockFormData>,
  ) => {
    onChange({
      ...value,
      blocks: value.blocks.map((block, i) =>
        i === index ? { ...block, ...patch } : block,
      ),
    });
  };

  const addStep = (blockIndex: number) => {
    onChange({
      ...value,
      blocks: value.blocks.map((block, i) =>
        i === blockIndex
          ? { ...block, steps: [...block.steps, defaultWorkflowStep()] }
          : block,
      ),
    });
  };

  const removeStep = (blockIndex: number, stepIndex: number) => {
    onChange({
      ...value,
      blocks: value.blocks.map((block, i) =>
        i === blockIndex
          ? {
              ...block,
              steps: block.steps.filter((_, j) => j !== stepIndex),
            }
          : block,
      ),
    });
  };

  const updateStep = (
    blockIndex: number,
    stepIndex: number,
    patch: Partial<TxWorkflowStepFormData>,
  ) => {
    onChange({
      ...value,
      blocks: value.blocks.map((block, i) =>
        i === blockIndex
          ? {
              ...block,
              steps: block.steps.map((step, j) =>
                j === stepIndex ? { ...step, ...patch } : step,
              ),
            }
          : block,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workflow-name">
            {t("workflowName")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="workflow-name"
            placeholder={t("workflowNamePlaceholder")}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div className="space-y-0.5">
            <Label>{t("workflowFailFast")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("workflowFailFastHint")}
            </p>
          </div>
          <Switch
            checked={value.failFast}
            onCheckedChange={(checked) =>
              onChange({ ...value, failFast: checked })
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        {value.blocks.map((block, blockIndex) => (
          <div key={blockIndex} className="rounded-md border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("blockNumber", { number: blockIndex + 1 })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeBlock(blockIndex)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("blockNameLabel")}</Label>
                <Input
                  placeholder={t("blockNamePlaceholder")}
                  value={block.name}
                  onChange={(e) =>
                    updateBlock(blockIndex, { name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("blockKind")}</Label>
                <Select
                  value={block.kind}
                  onValueChange={(next) =>
                    updateBlock(blockIndex, {
                      kind: next as WorkflowBlockKind,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="config">
                      {t("blockKindConfig")}
                    </SelectItem>
                    <SelectItem value="show">{t("blockKindShow")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border px-4 py-3">
                <div className="space-y-0.5">
                  <Label>{t("blockFailFast")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("blockFailFastHint")}
                  </p>
                </div>
                <Switch
                  checked={block.failFast}
                  onCheckedChange={(checked) =>
                    updateBlock(blockIndex, { failFast: checked })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rollbackPolicy")}</Label>
                <Select
                  value={block.rollbackPolicy}
                  onValueChange={(next) =>
                    updateBlock(blockIndex, {
                      rollbackPolicy: next as WorkflowRollbackPolicy,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_step">
                      {t("rollbackPolicyPerStep")}
                    </SelectItem>
                    <SelectItem value="whole_resource">
                      {t("rollbackPolicyWholeResource")}
                    </SelectItem>
                    <SelectItem value="none">
                      {t("rollbackPolicyNone")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {block.rollbackPolicy === "whole_resource" && (
              <div className="rounded-md border p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("wholeResourceMode")}</Label>
                    <Select
                      value={block.wholeResourceMode}
                      onValueChange={(next) =>
                        updateBlock(blockIndex, {
                          wholeResourceMode: next as TxMode,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Enable">
                          {t("modeEnable")}
                        </SelectItem>
                        <SelectItem value="Config">
                          {t("modeConfig")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("wholeResourceTimeout")}</Label>
                    <Input
                      inputMode="numeric"
                      placeholder={t("wholeResourceTimeoutPlaceholder")}
                      value={block.wholeResourceTimeoutSecs}
                      onChange={(e) =>
                        updateBlock(blockIndex, {
                          wholeResourceTimeoutSecs: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("wholeResourceUndoCommand")}</Label>
                  <Input
                    placeholder={t("wholeResourceUndoCommandPlaceholder")}
                    value={block.wholeResourceUndoCommand}
                    onChange={(e) =>
                      updateBlock(blockIndex, {
                        wholeResourceUndoCommand: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("wholeResourceTriggerStepIndex")}</Label>
                  <Input
                    inputMode="numeric"
                    placeholder={t("wholeResourceTriggerStepIndexPlaceholder")}
                    value={block.wholeResourceTriggerStepIndex}
                    onChange={(e) =>
                      updateBlock(blockIndex, {
                        wholeResourceTriggerStepIndex: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("commandList")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(blockIndex)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("addCommand")}
                </Button>
              </div>

              {block.steps.map((step, stepIndex) => (
                <div
                  key={stepIndex}
                  className="rounded-md border p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("stepNumber", { number: stepIndex + 1 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(blockIndex, stepIndex)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("stepMode")}</Label>
                      <Select
                        value={step.mode}
                        onValueChange={(next) =>
                          updateStep(blockIndex, stepIndex, {
                            mode: next as TxMode,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Enable">
                            {t("modeEnable")}
                          </SelectItem>
                          <SelectItem value="Config">
                            {t("modeConfig")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("stepTimeout")}</Label>
                      <Input
                        inputMode="numeric"
                        placeholder={t("stepTimeoutPlaceholder")}
                        value={step.timeoutSecs}
                        onChange={(e) =>
                          updateStep(blockIndex, stepIndex, {
                            timeoutSecs: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("commandLabel")}</Label>
                    <Input
                      placeholder={t("commandPlaceholder")}
                      value={step.command}
                      onChange={(e) =>
                        updateStep(blockIndex, stepIndex, {
                          command: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("rollbackCommand")}</Label>
                    <Input
                      placeholder={t("rollbackCommandPlaceholder")}
                      value={step.rollbackCommand}
                      onChange={(e) =>
                        updateStep(blockIndex, stepIndex, {
                          rollbackCommand: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border px-4 py-3">
                    <div className="space-y-0.5">
                      <Label>{t("rollbackOnFailure")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("rollbackOnFailureHint")}
                      </p>
                    </div>
                    <Switch
                      checked={step.rollbackOnFailure}
                      onCheckedChange={(checked) =>
                        updateStep(blockIndex, stepIndex, {
                          rollbackOnFailure: checked,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
}

function buildWorkflowJson(data: TxWorkflowFormData): Record<string, unknown> {
  return {
    name: data.name.trim(),
    fail_fast: data.failFast,
    blocks: data.blocks.map((block) => {
      const blockPayload: Record<string, unknown> = {
        name: block.name.trim(),
        kind: block.kind,
        fail_fast: block.failFast,
        steps: block.steps.map((step) => {
          const payload: Record<string, unknown> = {
            command: step.command.trim(),
            rollback_command: step.rollbackCommand.trim() || null,
            rollback_on_failure: step.rollbackOnFailure,
            ...(step.mode !== AUTO_PROFILE_MODE ? { mode: step.mode } : {}),
          };

          const timeoutSecs = parseOptionalPositiveInt(step.timeoutSecs);
          if (timeoutSecs !== undefined) {
            payload.timeout_secs = timeoutSecs;
          }

          return payload;
        }),
      };

      if (block.rollbackPolicy === "whole_resource") {
        const wholeResource: Record<string, unknown> = {
          undo_command: block.wholeResourceUndoCommand.trim(),
          ...(block.wholeResourceMode !== AUTO_PROFILE_MODE
            ? { mode: block.wholeResourceMode }
            : {}),
        };
        const timeoutSecs = parseOptionalPositiveInt(
          block.wholeResourceTimeoutSecs,
        );
        if (timeoutSecs !== undefined) {
          wholeResource.timeout_secs = timeoutSecs;
        }
        const triggerStepIndex = parseOptionalNonNegativeInt(
          block.wholeResourceTriggerStepIndex,
        );
        if (triggerStepIndex !== undefined) {
          wholeResource.trigger_step_index = triggerStepIndex;
        }
        blockPayload.rollback_policy = {
          whole_resource: wholeResource,
        };
      } else {
        blockPayload.rollback_policy = block.rollbackPolicy;
      }

      return blockPayload;
    }),
  };
}

export function buildTxWorkflowPayload(
  data: TxWorkflowFormData,
): Record<string, unknown> {
  return {
    workflow: buildWorkflowJson(data),
  };
}

export function validateTxWorkflowForm(
  data: TxWorkflowFormData,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
): string | null {
  if (!data.name.trim()) {
    return t("workflowNameRequired");
  }

  if (data.blocks.length === 0) {
    return t("addAtLeastOneBlock");
  }

  for (let i = 0; i < data.blocks.length; i += 1) {
    const block = data.blocks[i];
    if (!block.name.trim()) {
      return t("blockNameEmpty", { number: i + 1 });
    }
    if (block.steps.length === 0) {
      return t("blockNeedsStep", { number: i + 1 });
    }
    if (
      block.rollbackPolicy === "whole_resource" &&
      !block.wholeResourceUndoCommand.trim()
    ) {
      return t("wholeResourceUndoRequired", { number: i + 1 });
    }
    if (
      block.wholeResourceTimeoutSecs.trim() &&
      parseOptionalPositiveInt(block.wholeResourceTimeoutSecs) === undefined
    ) {
      return t("positiveIntegerRequired");
    }
    if (
      block.wholeResourceTriggerStepIndex.trim() &&
      parseOptionalNonNegativeInt(block.wholeResourceTriggerStepIndex) ===
        undefined
    ) {
      return t("nonNegativeIntegerRequired");
    }
    for (let j = 0; j < block.steps.length; j += 1) {
      const step = block.steps[j];
      if (!step.command.trim()) {
        return t("blockStepCommandEmpty", {
          blockNumber: i + 1,
          stepNumber: j + 1,
        });
      }
      if (
        step.timeoutSecs.trim() &&
        parseOptionalPositiveInt(step.timeoutSecs) === undefined
      ) {
        return t("positiveIntegerRequired");
      }
    }
  }

  return null;
}

export const defaultTxWorkflowFormData: TxWorkflowFormData = {
  name: "",
  failFast: true,
  blocks: [defaultWorkflowBlock()],
  rawJson: "",
  useRawJson: false,
};
