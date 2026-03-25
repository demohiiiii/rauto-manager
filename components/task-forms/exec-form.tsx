"use client";

import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

export interface ExecFormData {
  command: string;
  mode: string;
}

interface ExecFormProps {
  value: ExecFormData;
  onChange: (data: ExecFormData) => void;
  availableModes?: string[];
  modeHint?: string;
  modeDisabled?: boolean;
  modeLoading?: boolean;
}

export function ExecForm({
  value,
  onChange,
  availableModes = [],
  modeHint,
  modeDisabled = false,
  modeLoading = false,
}: ExecFormProps) {
  const t = useTranslations("taskForms");
  const selectableModes = [
    AUTO_PROFILE_MODE,
    ...availableModes.filter((mode) => mode !== AUTO_PROFILE_MODE),
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="exec-command">
          {t("execCommand")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="exec-command"
          placeholder={t("execCommandPlaceholder")}
          value={value.command}
          onChange={(e) => onChange({ ...value, command: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {t("execCommandHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exec-mode">{t("profileMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v })}
          disabled={modeDisabled || modeLoading}
        >
          <SelectTrigger id="exec-mode">
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
  );
}

export function buildExecPayload(data: ExecFormData): Record<string, unknown> {
  return {
    command: data.command,
    ...(data.mode !== AUTO_PROFILE_MODE ? { mode: data.mode } : {}),
  };
}

export function validateExecForm(data: ExecFormData, t: (key: string) => string): string | null {
  if (!data.command.trim()) return t("enterCommand");
  return null;
}

export const defaultExecFormData: ExecFormData = {
  command: "",
  mode: AUTO_PROFILE_MODE,
};
