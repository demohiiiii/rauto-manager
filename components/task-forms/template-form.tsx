"use client";

import { useEffect, useState } from "react";
import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";
import { Label } from "@/components/ui/label";
import {
  JsonObjectEditor,
  type StructuredJsonObject,
} from "@/components/task-forms/json-structure-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface TemplateFormData {
  template: string;
  variables: StructuredJsonObject;
  mode: string;
}

interface TemplateFormProps {
  value: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
  agentId: string;
  availableModes?: string[];
  modeHint?: string;
  modeDisabled?: boolean;
  modeLoading?: boolean;
}

interface TemplateItem {
  name: string;
  path: string;
}

export function TemplateForm({
  value,
  onChange,
  agentId,
  availableModes = [],
  modeHint,
  modeDisabled = false,
  modeLoading = false,
}: TemplateFormProps) {
  const t = useTranslations("taskForms");
  const tc = useTranslations("common");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const selectableModes = [
    AUTO_PROFILE_MODE,
    ...availableModes.filter((mode) => mode !== AUTO_PROFILE_MODE),
  ];

  useEffect(() => {
    if (!agentId) {
      setTemplates([]);
      return;
    }

    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agents/${agentId}/templates`);
        const result = await response.json();
        if (result.success && result.data?.templates) {
          setTemplates(result.data.templates);
        } else if (!result.success) {
          toast.error(
            t("fetchTemplatesFailed", {
              error: result.error || tc("unknownError"),
            }),
          );
        }
      } catch (error) {
        toast.error(
          t("fetchTemplatesFailed", {
            error: error instanceof Error ? error.message : tc("unknownError"),
          }),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [agentId, t, tc]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="template-name">
          {t("templateLabel")} <span className="text-destructive">*</span>
        </Label>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingTemplates")}
          </div>
        ) : (
          <Select
            value={value.template}
            onValueChange={(v) => onChange({ ...value, template: v })}
            disabled={!agentId}
          >
            <SelectTrigger id="template-name">
              <SelectValue
                placeholder={
                  agentId ? t("selectTemplate") : t("selectAgentFirst")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  {t("noTemplatesAvailable")}
                </div>
              ) : (
                templates.map((tpl) => (
                  <SelectItem key={tpl.name} value={tpl.name}>
                    {tpl.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-vars">{t("templateVariables")}</Label>
        <div id="template-vars">
          <JsonObjectEditor
            value={value.variables}
            onChange={(next) => onChange({ ...value, variables: next })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("templateVariablesHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-mode">{t("profileMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v })}
          disabled={modeDisabled || modeLoading}
        >
          <SelectTrigger id="template-mode">
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

export function buildTemplatePayload(
  data: TemplateFormData,
): Record<string, unknown> {
  return {
    template: data.template,
    vars: data.variables,
    ...(data.mode !== AUTO_PROFILE_MODE ? { mode: data.mode } : {}),
  };
}

export function validateTemplateForm(
  data: TemplateFormData,
  t: (key: string) => string,
): string | null {
  if (!data.template) return t("selectTemplateRequired");
  return null;
}

export const defaultTemplateFormData: TemplateFormData = {
  template: "",
  variables: {},
  mode: AUTO_PROFILE_MODE,
};
