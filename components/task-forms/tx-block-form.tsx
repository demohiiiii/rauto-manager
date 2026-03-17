"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export interface TxStep {
  command: string;
  rollback: string;
}

export interface TxBlockFormData {
  name: string;
  steps: TxStep[];
  mode: "enable" | "config";
}

interface TxBlockFormProps {
  value: TxBlockFormData;
  onChange: (data: TxBlockFormData) => void;
}

export function TxBlockForm({ value, onChange }: TxBlockFormProps) {
  const t = useTranslations("taskForms");
  const tc = useTranslations("common");

  const addStep = () => {
    onChange({
      ...value,
      steps: [...value.steps, { command: "", rollback: "" }],
    });
  };

  const removeStep = (index: number) => {
    onChange({
      ...value,
      steps: value.steps.filter((_, i) => i !== index),
    });
  };

  const updateStep = (index: number, field: keyof TxStep, val: string) => {
    onChange({
      ...value,
      steps: value.steps.map((s, i) =>
        i === index ? { ...s, [field]: val } : s
      ),
    });
  };

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-between">
          <Label>
            {t("commandList")} <span className="text-destructive">*</span>
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-3 w-3 mr-1" />
            {t("addCommand")}
          </Button>
        </div>

        {value.steps.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("noCommands")}
          </p>
        )}

        <div className="space-y-3">
          {value.steps.map((step, index) => (
            <div
              key={index}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("stepNumber", { number: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(index)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("commandLabel")}</Label>
                  <Input
                    placeholder={t("commandPlaceholder")}
                    value={step.command}
                    onChange={(e) => updateStep(index, "command", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("rollbackCommand")}</Label>
                  <Input
                    placeholder={t("rollbackPlaceholder")}
                    value={step.rollback}
                    onChange={(e) => updateStep(index, "rollback", e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="txblock-mode">{tc("executionMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as "enable" | "config" })}
        >
          <SelectTrigger id="txblock-mode">
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

export function buildTxBlockPayload(data: TxBlockFormData): Record<string, unknown> {
  return {
    name: data.name,
    commands: data.steps.map((s) => s.command),
    rollback_commands: data.steps.map((s) => s.rollback).filter(Boolean),
    mode: data.mode,
  };
}

export function validateTxBlockForm(data: TxBlockFormData, t: (key: string, params?: Record<string, string | number | Date>) => string): string | null {
  if (!data.name.trim()) return t("enterBlockName");
  if (data.steps.length === 0) return t("addAtLeastOneCommand");
  const emptyCmd = data.steps.findIndex((s) => !s.command.trim());
  if (emptyCmd >= 0) return t("stepCommandEmpty", { number: emptyCmd + 1 });
  return null;
}

export const defaultTxBlockFormData: TxBlockFormData = {
  name: "",
  steps: [{ command: "", rollback: "" }],
  mode: "config",
};
