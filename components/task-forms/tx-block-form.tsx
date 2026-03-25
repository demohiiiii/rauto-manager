"use client";

import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

type TxMode = string;
type TxBlockRollbackMode = "infer" | "per_step" | "whole_resource";

export interface TxBlockFormData {
  name: string;
  template: string;
  varsJson: string;
  commandsText: string;
  rollbackCommandsText: string;
  mode: TxMode;
  timeoutSecs: string;
  rollbackMode: TxBlockRollbackMode;
  rollbackOnFailure: boolean;
  resourceRollbackCommand: string;
  rollbackTriggerStepIndex: string;
  templateProfile: string;
}

interface TxBlockFormProps {
  value: TxBlockFormData;
  onChange: (data: TxBlockFormData) => void;
  availableModes?: string[];
  modeHint?: string;
  modeDisabled?: boolean;
  modeLoading?: boolean;
}

function parseCommandLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRollbackLinesRaw(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim());
}

function trimTrailingEmpty(values: string[]): string[] {
  const next = [...values];
  while (next.length > 0 && !next[next.length - 1].trim()) {
    next.pop();
  }
  return next;
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
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="txblock-mode">{t("txBlockMode")}</Label>
          <Select
            value={value.mode}
            onValueChange={(next) => onChange({ ...value, mode: next as TxMode })}
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
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label htmlFor="txblock-template">{t("txBlockTemplate")}</Label>
          <Input
            id="txblock-template"
            placeholder={t("txBlockTemplatePlaceholder")}
            value={value.template}
            onChange={(e) => onChange({ ...value, template: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {t("txBlockTemplateHint")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="txblock-template-profile">
              {t("txBlockTemplateProfile")}
            </Label>
            <Input
              id="txblock-template-profile"
              placeholder={t("txBlockTemplateProfilePlaceholder")}
              value={value.templateProfile}
              onChange={(e) =>
                onChange({ ...value, templateProfile: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="txblock-timeout">{t("txBlockTimeout")}</Label>
            <Input
              id="txblock-timeout"
              inputMode="numeric"
              placeholder={t("txBlockTimeoutPlaceholder")}
              value={value.timeoutSecs}
              onChange={(e) =>
                onChange({ ...value, timeoutSecs: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="txblock-vars">{t("txBlockVars")}</Label>
          <Textarea
            id="txblock-vars"
            className="min-h-[120px] font-mono text-sm"
            placeholder='{"hostname":"core-01"}'
            value={value.varsJson}
            onChange={(e) => onChange({ ...value, varsJson: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("txBlockVarsHint")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="txblock-commands">{t("commandList")}</Label>
        <Textarea
          id="txblock-commands"
          className="min-h-[160px] font-mono text-sm"
          placeholder={t("txBlockCommandsPlaceholder")}
          value={value.commandsText}
          onChange={(e) => onChange({ ...value, commandsText: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {t("txBlockCommandsHint")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="txblock-rollback-mode">{t("txBlockRollbackMode")}</Label>
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
              <SelectItem value="infer">
                {t("txBlockRollbackModeInfer")}
              </SelectItem>
              <SelectItem value="per_step">
                {t("txBlockRollbackModePerStep")}
              </SelectItem>
              <SelectItem value="whole_resource">
                {t("txBlockRollbackModeWholeResource")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div className="space-y-0.5">
            <Label>{t("txBlockRollbackOnFailure")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("txBlockRollbackOnFailureHint")}
            </p>
          </div>
          <Switch
            checked={value.rollbackOnFailure}
            onCheckedChange={(checked) =>
              onChange({ ...value, rollbackOnFailure: checked })
            }
          />
        </div>
      </div>

      {value.rollbackMode === "per_step" && (
        <div className="space-y-2">
          <Label htmlFor="txblock-rollbacks">{t("rollbackCommand")}</Label>
          <Textarea
            id="txblock-rollbacks"
            className="min-h-[140px] font-mono text-sm"
            placeholder={t("txBlockRollbackCommandsPlaceholder")}
            value={value.rollbackCommandsText}
            onChange={(e) =>
              onChange({ ...value, rollbackCommandsText: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("txBlockRollbackCommandsHint")}
          </p>
        </div>
      )}

      {value.rollbackMode === "whole_resource" && (
        <div className="rounded-md border p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="txblock-resource-rollback">
              {t("txBlockResourceRollbackCommand")}
            </Label>
            <Input
              id="txblock-resource-rollback"
              placeholder={t("txBlockResourceRollbackPlaceholder")}
              value={value.resourceRollbackCommand}
              onChange={(e) =>
                onChange({
                  ...value,
                  resourceRollbackCommand: e.target.value,
                })
              }
            />
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
              onChange={(e) =>
                onChange({
                  ...value,
                  rollbackTriggerStepIndex: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function buildTxBlockPayload(data: TxBlockFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    ...(data.mode !== AUTO_PROFILE_MODE ? { mode: data.mode } : {}),
  };

  const template = data.template.trim();
  if (template) {
    payload.template = template;
  }

  if (data.varsJson.trim()) {
    payload.vars = JSON.parse(data.varsJson);
  } else {
    payload.vars = {};
  }

  const commands = parseCommandLines(data.commandsText);
  if (commands.length > 0) {
    payload.commands = commands;
  }

  const timeoutSecs = parseOptionalPositiveInt(data.timeoutSecs);
  if (timeoutSecs !== undefined) {
    payload.timeout_secs = timeoutSecs;
  }

  if (data.rollbackOnFailure) {
    payload.rollback_on_failure = true;
  }

  const templateProfile = data.templateProfile.trim();
  if (templateProfile) {
    payload.template_profile = templateProfile;
  }

  if (data.rollbackMode === "per_step") {
    const rollbackCommands = trimTrailingEmpty(
      parseRollbackLinesRaw(data.rollbackCommandsText)
    );
    if (rollbackCommands.length > 0) {
      payload.rollback_commands = rollbackCommands;
    }
  }

  if (data.rollbackMode === "whole_resource") {
    const resourceRollbackCommand = data.resourceRollbackCommand.trim();
    if (resourceRollbackCommand) {
      payload.resource_rollback_command = resourceRollbackCommand;
    }

    const rollbackTriggerStepIndex = parseOptionalNonNegativeInt(
      data.rollbackTriggerStepIndex
    );
    if (rollbackTriggerStepIndex !== undefined) {
      payload.rollback_trigger_step_index = rollbackTriggerStepIndex;
    }
  }

  return payload;
}

export function validateTxBlockForm(
  data: TxBlockFormData,
  t: (key: string, params?: Record<string, string | number | Date>) => string
): string | null {
  if (!data.name.trim()) {
    return t("enterBlockName");
  }

  if (data.varsJson.trim()) {
    try {
      JSON.parse(data.varsJson);
    } catch {
      return t("txBlockVarsInvalidJson");
    }
  }

  const commands = parseCommandLines(data.commandsText);
  if (!data.template.trim() && commands.length === 0) {
    return t("txBlockNeedsTemplateOrCommands");
  }

  if (
    data.timeoutSecs.trim() &&
    parseOptionalPositiveInt(data.timeoutSecs) === undefined
  ) {
    return t("positiveIntegerRequired");
  }

  if (
    data.rollbackTriggerStepIndex.trim() &&
    parseOptionalNonNegativeInt(data.rollbackTriggerStepIndex) === undefined
  ) {
    return t("nonNegativeIntegerRequired");
  }

  if (
    data.rollbackMode === "whole_resource" &&
    data.rollbackTriggerStepIndex.trim() &&
    !data.resourceRollbackCommand.trim()
  ) {
    return t("txBlockRollbackTriggerRequiresResourceRollback");
  }

  if (
    data.rollbackMode === "whole_resource" &&
    !data.resourceRollbackCommand.trim()
  ) {
    return t("txBlockResourceRollbackRequired");
  }

  return null;
}

export const defaultTxBlockFormData: TxBlockFormData = {
  name: "",
  template: "",
  varsJson: "",
  commandsText: "",
  rollbackCommandsText: "",
  mode: AUTO_PROFILE_MODE,
  timeoutSecs: "",
  rollbackMode: "infer",
  rollbackOnFailure: false,
  resourceRollbackCommand: "",
  rollbackTriggerStepIndex: "",
  templateProfile: "",
};
