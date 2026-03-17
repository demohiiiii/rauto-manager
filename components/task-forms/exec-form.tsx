"use client";

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
  mode: "enable" | "config";
}

interface ExecFormProps {
  value: ExecFormData;
  onChange: (data: ExecFormData) => void;
}

export function ExecForm({ value, onChange }: ExecFormProps) {
  const t = useTranslations("taskForms");
  const tc = useTranslations("common");

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
        <Label htmlFor="exec-mode">{tc("executionMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as "enable" | "config" })}
        >
          <SelectTrigger id="exec-mode">
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

export function buildExecPayload(data: ExecFormData): Record<string, unknown> {
  return {
    command: data.command,
    mode: data.mode,
  };
}

export function validateExecForm(data: ExecFormData, t: (key: string) => string): string | null {
  if (!data.command.trim()) return t("enterCommand");
  return null;
}

export const defaultExecFormData: ExecFormData = {
  command: "",
  mode: "enable",
};
