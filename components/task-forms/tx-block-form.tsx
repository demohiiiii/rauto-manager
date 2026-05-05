"use client";

import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  JsonObjectEditor,
  type StructuredJsonObject,
  toStructuredJsonObject,
} from "@/components/task-forms/json-structure-editor";
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
type TxBlockSourceKind = "steps" | "tx_block_template";
type TxBlockRollbackMode = "per_step" | "whole_resource" | "none";
type TxBlockOperationKind = "command" | "template" | "command_flow_template";

interface TxBlockOperationFormData {
  kind: TxBlockOperationKind;
  mode: TxMode;
  command: string;
  commandsText: string;
  template: StructuredJsonObject;
  vars: StructuredJsonObject;
  timeoutSecs: string;
  stopOnError: boolean;
}

interface TxBlockStepFormData {
  run: TxBlockOperationFormData;
  rollbackEnabled: boolean;
  rollback: TxBlockOperationFormData;
  rollbackOnFailure: boolean;
}

export interface TxBlockFormData {
  name: string;
  sourceKind: TxBlockSourceKind;
  failFast: boolean;
  template: string;
  templateContent: string;
  vars: StructuredJsonObject;
  mode: TxMode;
  timeoutSecs: string;
  rollbackMode: TxBlockRollbackMode;
  rollbackOnFailure: boolean;
  resourceRollback: TxBlockOperationFormData;
  rollbackTriggerStepIndex: string;
  templateProfile: string;
  steps: TxBlockStepFormData[];
}

interface TxBlockFormProps {
  value: TxBlockFormData;
  onChange: (data: TxBlockFormData) => void;
  availableModes?: string[];
  modeHint?: string;
  modeDisabled?: boolean;
  modeLoading?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumberString(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
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

function defaultOperation(
  kind: TxBlockOperationKind = "command",
): TxBlockOperationFormData {
  return {
    kind,
    mode: AUTO_PROFILE_MODE,
    command: "",
    commandsText: "",
    template: {},
    vars: {},
    timeoutSecs: "",
    stopOnError: true,
  };
}

function defaultStep(): TxBlockStepFormData {
  return {
    run: defaultOperation(),
    rollbackEnabled: false,
    rollback: defaultOperation(),
    rollbackOnFailure: false,
  };
}

function parseOperation(value: unknown): TxBlockOperationFormData {
  const normalized = asRecord(value) ?? {};
  const kind = normalized.kind;

  if (kind === "template") {
    const runtime = asRecord(normalized.runtime) ?? {};
    const template = normalized.template;

    if (
      typeof template === "string" ||
      typeof normalized.template_content === "string"
    ) {
      return {
        ...defaultOperation("template"),
        mode:
          typeof normalized.mode === "string"
            ? normalized.mode
            : AUTO_PROFILE_MODE,
        command: asString(template),
        commandsText: asString(normalized.template_content),
        vars: toStructuredJsonObject(normalized.vars ?? runtime.vars),
        timeoutSecs: asNumberString(normalized.timeout),
      };
    }

    return {
      ...defaultOperation("command_flow_template"),
      mode:
        typeof runtime.default_mode === "string"
          ? runtime.default_mode
          : AUTO_PROFILE_MODE,
      template: toStructuredJsonObject(normalized.template),
      vars: toStructuredJsonObject(runtime.vars),
    };
  }

  return {
    ...defaultOperation(),
    mode:
      typeof normalized.mode === "string" ? normalized.mode : AUTO_PROFILE_MODE,
    command: asString(normalized.command),
    timeoutSecs: asNumberString(normalized.timeout),
  };
}

function parseStepsFromTxBlock(txBlock: Record<string, unknown>) {
  const steps = Array.isArray(txBlock.steps) ? txBlock.steps : [];

  return steps.length > 0
    ? steps.map((step) => {
        const normalizedStep = asRecord(step) ?? {};

        return {
          run: parseOperation(normalizedStep.run),
          rollbackEnabled: Boolean(normalizedStep.rollback),
          rollback: parseOperation(normalizedStep.rollback),
          rollbackOnFailure: normalizedStep.rollback_on_failure === true,
        };
      })
    : [defaultStep()];
}

function parseLegacySteps(payload: Record<string, unknown>) {
  const commands = Array.isArray(payload.commands)
    ? payload.commands.filter(
        (command): command is string => typeof command === "string",
      )
    : [];
  const rollbackCommands = Array.isArray(payload.rollback_commands)
    ? payload.rollback_commands.map((command) =>
        typeof command === "string" ? command : "",
      )
    : [];
  const mode =
    typeof payload.mode === "string" ? payload.mode : AUTO_PROFILE_MODE;
  const timeoutSecs =
    typeof payload.timeout_secs === "number"
      ? String(payload.timeout_secs)
      : "";

  return commands.length > 0
    ? commands.map((command, index) => {
        const rollbackCommand = rollbackCommands[index] ?? "";

        return {
          run: {
            ...defaultOperation(),
            mode,
            command,
            timeoutSecs,
          },
          rollbackEnabled: Boolean(rollbackCommand.trim()),
          rollback: {
            ...defaultOperation(),
            mode,
            command: rollbackCommand,
            timeoutSecs,
          },
          rollbackOnFailure: payload.rollback_on_failure === true,
        };
      })
    : [defaultStep()];
}

export function parseTxBlockPayloadToFormData(
  payload: unknown,
): TxBlockFormData {
  const normalizedPayload = asRecord(payload) ?? {};
  const txBlock = asRecord(normalizedPayload.tx_block);
  const rollbackPolicy = asRecord(txBlock?.rollback_policy);
  const wholeResource = asRecord(rollbackPolicy?.whole_resource);
  const hasWholeResourceRollback =
    Boolean(wholeResource?.rollback) ||
    typeof normalizedPayload.resource_rollback_command === "string" ||
    typeof normalizedPayload.rollback_trigger_step_index === "number";
  const hasTemplateSource = Boolean(
    asString(normalizedPayload.tx_block_template_name).trim() ||
    asString(normalizedPayload.tx_block_template_content).trim() ||
    asString(normalizedPayload.template).trim() ||
    asString(normalizedPayload.template_content).trim(),
  );

  const resourceRollback = wholeResource?.rollback
    ? parseOperation(wholeResource.rollback)
    : {
        ...defaultOperation(),
        mode:
          typeof normalizedPayload.mode === "string"
            ? normalizedPayload.mode
            : AUTO_PROFILE_MODE,
        command: asString(normalizedPayload.resource_rollback_command),
        timeoutSecs:
          typeof normalizedPayload.timeout_secs === "number"
            ? String(normalizedPayload.timeout_secs)
            : "",
      };

  return {
    name: asString(txBlock?.name) || asString(normalizedPayload.name) || "",
    sourceKind: hasTemplateSource ? "tx_block_template" : "steps",
    failFast: txBlock ? txBlock.fail_fast !== false : true,
    template:
      asString(normalizedPayload.tx_block_template_name) ||
      asString(normalizedPayload.template),
    templateContent:
      asString(normalizedPayload.tx_block_template_content) ||
      asString(normalizedPayload.template_content),
    vars: toStructuredJsonObject(
      normalizedPayload.tx_block_template_vars ?? normalizedPayload.vars,
    ),
    mode:
      typeof normalizedPayload.mode === "string"
        ? normalizedPayload.mode
        : AUTO_PROFILE_MODE,
    timeoutSecs:
      typeof normalizedPayload.timeout_secs === "number"
        ? String(normalizedPayload.timeout_secs)
        : "",
    rollbackMode: hasWholeResourceRollback
      ? "whole_resource"
      : txBlock?.rollback_policy === "none"
        ? "none"
        : "per_step",
    rollbackOnFailure: normalizedPayload.rollback_on_failure === true,
    resourceRollback,
    rollbackTriggerStepIndex:
      typeof wholeResource?.trigger_step_index === "number"
        ? String(wholeResource.trigger_step_index)
        : typeof normalizedPayload.rollback_trigger_step_index === "number"
          ? String(normalizedPayload.rollback_trigger_step_index)
          : "",
    templateProfile:
      typeof normalizedPayload.template_profile === "string"
        ? normalizedPayload.template_profile
        : "",
    steps: txBlock
      ? parseStepsFromTxBlock(txBlock)
      : parseLegacySteps(normalizedPayload),
  };
}

function buildCommandOperation(
  operation: TxBlockOperationFormData,
  fallbackMode: string,
): Record<string, unknown> {
  const mode =
    operation.mode !== AUTO_PROFILE_MODE
      ? operation.mode
      : fallbackMode !== AUTO_PROFILE_MODE
        ? fallbackMode
        : "Config";
  const timeout = parseOptionalPositiveInt(operation.timeoutSecs);

  return {
    mode,
    command: operation.command.trim(),
    ...(timeout !== undefined ? { timeout } : {}),
  };
}

function buildOperation(
  operation: TxBlockOperationFormData,
  fallbackMode: string,
): Record<string, unknown> {
  if (operation.kind === "template") {
    const mode =
      operation.mode !== AUTO_PROFILE_MODE
        ? operation.mode
        : fallbackMode !== AUTO_PROFILE_MODE
          ? fallbackMode
          : "Config";
    const timeout = parseOptionalPositiveInt(operation.timeoutSecs);
    return {
      kind: "template",
      template: operation.command.trim(),
      template_content: operation.commandsText.trim(),
      vars: operation.vars,
      mode,
      ...(timeout !== undefined ? { timeout } : {}),
    };
  }

  if (operation.kind === "command_flow_template") {
    const runtime: Record<string, unknown> = {
      vars: operation.vars,
    };
    if (operation.mode !== AUTO_PROFILE_MODE) {
      runtime.default_mode = operation.mode;
    }

    return {
      kind: "template",
      template: operation.template,
      runtime,
    };
  }

  return {
    kind: "command",
    ...buildCommandOperation(operation, fallbackMode),
  };
}

function operationHasInput(operation: TxBlockOperationFormData): boolean {
  if (operation.kind === "command") {
    return Boolean(operation.command.trim());
  }
  if (operation.kind === "template") {
    return Boolean(operation.command.trim() || operation.commandsText.trim());
  }
  return Object.keys(operation.template).length > 0;
}

function renderOperationLabel(
  kind: TxBlockOperationKind,
  t: (key: string) => string,
) {
  if (kind === "template") {
    return t("txBlockOperationTemplate");
  }
  if (kind === "command_flow_template") {
    return t("txBlockOperationCommandFlowTemplate");
  }
  return t("txBlockOperationCommand");
}

function OperationEditor({
  idPrefix,
  value,
  onChange,
  availableModes,
  modeDisabled,
  modeLoading,
  title,
}: {
  idPrefix: string;
  value: TxBlockOperationFormData;
  onChange: (data: TxBlockOperationFormData) => void;
  availableModes: string[];
  modeDisabled: boolean;
  modeLoading: boolean;
  title: string;
}) {
  const t = useTranslations("taskForms");

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-kind`}>{title}</Label>
          <Select
            value={value.kind}
            onValueChange={(next) =>
              onChange({
                ...defaultOperation(next as TxBlockOperationKind),
                mode: value.mode,
                timeoutSecs: value.timeoutSecs,
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-kind`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="command">
                {t("txBlockOperationCommand")}
              </SelectItem>
              <SelectItem value="template">
                {t("txBlockOperationTemplate")}
              </SelectItem>
              <SelectItem value="command_flow_template">
                {t("txBlockOperationCommandFlowTemplate")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-mode`}>{t("stepMode")}</Label>
          <Select
            value={value.mode}
            onValueChange={(next) => onChange({ ...value, mode: next })}
            disabled={modeDisabled || modeLoading}
          >
            <SelectTrigger id={`${idPrefix}-mode`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableModes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode === AUTO_PROFILE_MODE ? t("profileModeAuto") : mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-timeout`}>{t("stepTimeout")}</Label>
          <Input
            id={`${idPrefix}-timeout`}
            inputMode="numeric"
            placeholder={t("stepTimeoutPlaceholder")}
            value={value.timeoutSecs}
            onChange={(event) =>
              onChange({ ...value, timeoutSecs: event.target.value })
            }
          />
        </div>
      </div>

      {value.kind === "command" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-command`}>{t("commandLabel")}</Label>
          <Input
            id={`${idPrefix}-command`}
            placeholder={t("commandPlaceholder")}
            value={value.command}
            onChange={(event) =>
              onChange({ ...value, command: event.target.value })
            }
          />
        </div>
      ) : null}

      {value.kind === "template" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-template-name`}>
              {t("txBlockOperationTemplateName")}
            </Label>
            <Input
              id={`${idPrefix}-template-name`}
              placeholder={t("txBlockTemplatePlaceholder")}
              value={value.command}
              onChange={(event) =>
                onChange({ ...value, command: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-template-content`}>
              {t("txBlockOperationTemplateContent")}
            </Label>
            <Textarea
              id={`${idPrefix}-template-content`}
              className="min-h-35 font-mono text-sm"
              placeholder={t("txBlockTemplateContentPlaceholder")}
              value={value.commandsText}
              onChange={(event) =>
                onChange({ ...value, commandsText: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("txBlockVars")}</Label>
            <JsonObjectEditor
              value={value.vars}
              onChange={(next) => onChange({ ...value, vars: next })}
            />
          </div>
        </div>
      ) : null}

      {value.kind === "command_flow_template" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("txBlockCommandFlowTemplate")}</Label>
            <JsonObjectEditor
              value={value.template}
              onChange={(next) => onChange({ ...value, template: next })}
            />
            <p className="text-xs text-muted-foreground">
              {t("txBlockCommandFlowTemplateHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("txBlockCommandFlowTemplateVars")}</Label>
            <JsonObjectEditor
              value={value.vars}
              onChange={(next) => onChange({ ...value, vars: next })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TxBlockForm({
  value,
  onChange,
  availableModes = [],
  modeHint,
  modeDisabled = false,
  modeLoading = false,
}: TxBlockFormProps) {
  const t = useTranslations("taskForms");
  const selectableModes = [
    AUTO_PROFILE_MODE,
    ...availableModes.filter((mode) => mode !== AUTO_PROFILE_MODE),
  ];

  const updateStep = (index: number, patch: Partial<TxBlockStepFormData>) => {
    onChange({
      ...value,
      steps: value.steps.map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...patch } : step,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="txblock-name">
            {t("txBlockName")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="txblock-name"
            placeholder={t("txBlockNamePlaceholder")}
            value={value.name}
            onChange={(event) =>
              onChange({ ...value, name: event.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="txblock-source-kind">{t("txBlockSource")}</Label>
          <Select
            value={value.sourceKind}
            onValueChange={(next) =>
              onChange({ ...value, sourceKind: next as TxBlockSourceKind })
            }
          >
            <SelectTrigger id="txblock-source-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="steps">{t("txBlockSourceSteps")}</SelectItem>
              <SelectItem value="tx_block_template">
                {t("txBlockSourceTxBlockTemplate")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="txblock-mode">{t("txBlockMode")}</Label>
          <Select
            value={value.mode}
            onValueChange={(next) => onChange({ ...value, mode: next })}
            disabled={modeDisabled || modeLoading}
          >
            <SelectTrigger id="txblock-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableModes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode === AUTO_PROFILE_MODE ? t("profileModeAuto") : mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modeHint ? (
            <p className="text-xs text-muted-foreground">{modeHint}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="txblock-timeout">{t("txBlockTimeout")}</Label>
          <Input
            id="txblock-timeout"
            inputMode="numeric"
            placeholder={t("txBlockTimeoutPlaceholder")}
            value={value.timeoutSecs}
            onChange={(event) =>
              onChange({ ...value, timeoutSecs: event.target.value })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div className="space-y-0.5">
            <Label>{t("txBlockFailFast")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("txBlockFailFastHint")}
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

      {value.sourceKind === "tx_block_template" ? (
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="txblock-template">{t("txBlockTemplate")}</Label>
              <Input
                id="txblock-template"
                placeholder={t("txBlockTemplatePlaceholder")}
                value={value.template}
                onChange={(event) =>
                  onChange({ ...value, template: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txblock-template-profile">
                {t("txBlockTemplateProfile")}
              </Label>
              <Input
                id="txblock-template-profile"
                placeholder={t("txBlockTemplateProfilePlaceholder")}
                value={value.templateProfile}
                onChange={(event) =>
                  onChange({ ...value, templateProfile: event.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="txblock-template-content">
              {t("txBlockTemplateContent")}
            </Label>
            <Textarea
              id="txblock-template-content"
              className="min-h-35 font-mono text-sm"
              placeholder={t("txBlockTemplateContentPlaceholder")}
              value={value.templateContent}
              onChange={(event) =>
                onChange({ ...value, templateContent: event.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("txBlockTemplateHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("txBlockVars")}</Label>
            <JsonObjectEditor
              value={value.vars}
              onChange={(next) => onChange({ ...value, vars: next })}
            />
            <p className="text-xs text-muted-foreground">
              {t("txBlockVarsHint")}
            </p>
          </div>
        </div>
      ) : null}

      {value.sourceKind === "steps" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("txBlockSteps")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("txBlockStepsHint")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ ...value, steps: [...value.steps, defaultStep()] })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("txBlockAddStep")}
            </Button>
          </div>

          {value.steps.map((step, stepIndex) => (
            <div key={stepIndex} className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {t("stepNumber", { number: stepIndex + 1 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {renderOperationLabel(step.run.kind, t)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onChange({
                      ...value,
                      steps: value.steps.filter(
                        (_, index) => index !== stepIndex,
                      ),
                    })
                  }
                  disabled={value.steps.length <= 1}
                  aria-label={t("txBlockRemoveStep")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <OperationEditor
                idPrefix={`txblock-step-${stepIndex}-run`}
                title={t("txBlockRunOperation")}
                value={step.run}
                onChange={(next) => updateStep(stepIndex, { run: next })}
                availableModes={selectableModes}
                modeDisabled={modeDisabled}
                modeLoading={modeLoading}
              />

              <div className="flex items-center justify-between rounded-md border px-4 py-3">
                <div className="space-y-0.5">
                  <Label>{t("txBlockStepRollbackEnabled")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("txBlockStepRollbackEnabledHint")}
                  </p>
                </div>
                <Switch
                  checked={step.rollbackEnabled}
                  onCheckedChange={(checked) =>
                    updateStep(stepIndex, { rollbackEnabled: checked })
                  }
                />
              </div>

              {step.rollbackEnabled ? (
                <OperationEditor
                  idPrefix={`txblock-step-${stepIndex}-rollback`}
                  title={t("txBlockRollbackOperation")}
                  value={step.rollback}
                  onChange={(next) => updateStep(stepIndex, { rollback: next })}
                  availableModes={selectableModes}
                  modeDisabled={modeDisabled}
                  modeLoading={modeLoading}
                />
              ) : null}

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
                    updateStep(stepIndex, { rollbackOnFailure: checked })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="txblock-rollback-mode">
            {t("txBlockRollbackMode")}
          </Label>
          <Select
            value={value.rollbackMode}
            onValueChange={(next) =>
              onChange({ ...value, rollbackMode: next as TxBlockRollbackMode })
            }
          >
            <SelectTrigger id="txblock-rollback-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_step">
                {t("txBlockRollbackModePerStep")}
              </SelectItem>
              <SelectItem value="whole_resource">
                {t("txBlockRollbackModeWholeResource")}
              </SelectItem>
              <SelectItem value="none">
                {t("txBlockRollbackModeNone")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="txblock-trigger-step">
            {t("txBlockRollbackTriggerStepIndex")}
          </Label>
          <Input
            id="txblock-trigger-step"
            inputMode="numeric"
            placeholder={t("txBlockRollbackTriggerStepIndexPlaceholder")}
            value={value.rollbackTriggerStepIndex}
            onChange={(event) =>
              onChange({
                ...value,
                rollbackTriggerStepIndex: event.target.value,
              })
            }
            disabled={value.rollbackMode !== "whole_resource"}
          />
        </div>
      </div>

      {value.rollbackMode === "whole_resource" ? (
        <OperationEditor
          idPrefix="txblock-resource-rollback"
          title={t("txBlockResourceRollbackOperation")}
          value={value.resourceRollback}
          onChange={(next) => onChange({ ...value, resourceRollback: next })}
          availableModes={selectableModes}
          modeDisabled={modeDisabled}
          modeLoading={modeLoading}
        />
      ) : null}
    </div>
  );
}

export function buildTxBlockPayload(
  data: TxBlockFormData,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    ...(data.mode !== AUTO_PROFILE_MODE ? { mode: data.mode } : {}),
  };

  const timeoutSecs = parseOptionalPositiveInt(data.timeoutSecs);
  if (timeoutSecs !== undefined) {
    payload.timeout_secs = timeoutSecs;
  }

  const templateProfile = data.templateProfile.trim();
  if (templateProfile) {
    payload.template_profile = templateProfile;
  }

  if (data.sourceKind === "tx_block_template") {
    const template = data.template.trim();
    const templateContent = data.templateContent.trim();
    if (template) {
      payload.template = template;
      payload.tx_block_template_name = template;
    }
    if (templateContent) {
      payload.template_content = templateContent;
      payload.tx_block_template_content = templateContent;
    }
    payload.vars = data.vars;
    payload.tx_block_template_vars = data.vars;
    return payload;
  }

  const txBlock: Record<string, unknown> = {
    name: data.name.trim(),
    fail_fast: data.failFast,
    steps: data.steps.map((step) => ({
      run: buildOperation(step.run, data.mode),
      rollback: step.rollbackEnabled
        ? buildOperation(step.rollback, data.mode)
        : null,
      rollback_on_failure: step.rollbackOnFailure,
    })),
  };

  if (data.rollbackMode === "whole_resource") {
    const wholeResource: Record<string, unknown> = {
      rollback: buildOperation(data.resourceRollback, data.mode),
    };
    const triggerStepIndex = parseOptionalNonNegativeInt(
      data.rollbackTriggerStepIndex,
    );
    if (triggerStepIndex !== undefined) {
      wholeResource.trigger_step_index = triggerStepIndex;
    }
    txBlock.rollback_policy = { whole_resource: wholeResource };
  } else {
    txBlock.rollback_policy =
      data.rollbackMode === "none" ? "none" : "per_step";
  }

  payload.tx_block = txBlock;
  return payload;
}

function validateOperation(
  operation: TxBlockOperationFormData,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
  label: string,
): string | null {
  if (
    operation.timeoutSecs.trim() &&
    !parseOptionalPositiveInt(operation.timeoutSecs)
  ) {
    return t("txBlockOperationTimeoutInvalid", { label });
  }
  if (!operationHasInput(operation)) {
    return t("txBlockOperationRequired", { label });
  }
  return null;
}

export function validateTxBlockForm(
  data: TxBlockFormData,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
): string | null {
  if (!data.name.trim()) {
    return t("enterBlockName");
  }

  if (
    data.timeoutSecs.trim() &&
    parseOptionalPositiveInt(data.timeoutSecs) === undefined
  ) {
    return t("positiveIntegerRequired");
  }

  if (data.sourceKind === "tx_block_template") {
    if (!data.template.trim() && !data.templateContent.trim()) {
      return t("txBlockTemplateSourceRequired");
    }
    return null;
  }

  if (data.steps.length === 0) {
    return t("txBlockNeedsStep");
  }

  for (const [stepIndex, step] of data.steps.entries()) {
    const stepNumber = stepIndex + 1;
    const runError = validateOperation(
      step.run,
      t,
      t("txBlockStepRunLabel", { number: stepNumber }),
    );
    if (runError) {
      return runError;
    }
    if (step.rollbackEnabled) {
      const rollbackError = validateOperation(
        step.rollback,
        t,
        t("txBlockStepRollbackLabel", { number: stepNumber }),
      );
      if (rollbackError) {
        return rollbackError;
      }
    }
  }

  if (
    data.rollbackTriggerStepIndex.trim() &&
    parseOptionalNonNegativeInt(data.rollbackTriggerStepIndex) === undefined
  ) {
    return t("nonNegativeIntegerRequired");
  }

  if (data.rollbackMode === "whole_resource") {
    const resourceRollbackError = validateOperation(
      data.resourceRollback,
      t,
      t("txBlockResourceRollbackOperation"),
    );
    if (resourceRollbackError) {
      return resourceRollbackError;
    }
  }

  return null;
}

export const defaultTxBlockFormData: TxBlockFormData = {
  name: "",
  sourceKind: "steps",
  failFast: true,
  template: "",
  templateContent: "",
  vars: {},
  mode: AUTO_PROFILE_MODE,
  timeoutSecs: "",
  rollbackMode: "per_step",
  rollbackOnFailure: false,
  resourceRollback: defaultOperation(),
  rollbackTriggerStepIndex: "",
  templateProfile: "",
  steps: [defaultStep()],
};
