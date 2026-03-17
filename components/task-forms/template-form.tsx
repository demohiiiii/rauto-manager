"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface TemplateFormData {
  template: string;
  variables: string;
  mode: "enable" | "config";
}

interface TemplateFormProps {
  value: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
  agentId: string;
}

interface TemplateItem {
  name: string;
  path: string;
}

export function TemplateForm({ value, onChange, agentId }: TemplateFormProps) {
  const t = useTranslations("taskForms");
  const tc = useTranslations("common");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

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
          toast.error(t("fetchTemplatesFailed", { error: result.error || tc("unknownError") }));
        }
      } catch (error) {
        toast.error(t("fetchTemplatesFailed", { error: error instanceof Error ? error.message : tc("unknownError") }));
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [agentId]);

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
              <SelectValue placeholder={agentId ? t("selectTemplate") : t("selectAgentFirst")} />
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
        <Textarea
          id="template-vars"
          className="font-mono text-sm min-h-[100px]"
          placeholder='{"hostname": "R1", "interface": "GigabitEthernet0/0"}'
          value={value.variables}
          onChange={(e) => onChange({ ...value, variables: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {t("templateVariablesHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-mode">{tc("executionMode")}</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as "enable" | "config" })}
        >
          <SelectTrigger id="template-mode">
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

export function buildTemplatePayload(data: TemplateFormData): Record<string, unknown> {
  let variables: Record<string, unknown> = {};
  if (data.variables.trim()) {
    try {
      variables = JSON.parse(data.variables);
    } catch {
      // validateTemplateForm will catch this error
    }
  }

  return {
    template: data.template,
    vars: variables,
    mode: data.mode,
  };
}

export function validateTemplateForm(data: TemplateFormData, t: (key: string) => string): string | null {
  if (!data.template) return t("selectTemplateRequired");
  if (data.variables.trim()) {
    try {
      JSON.parse(data.variables);
    } catch {
      return t("templateVariablesInvalidJson");
    }
  }
  return null;
}

export const defaultTemplateFormData: TemplateFormData = {
  template: "",
  variables: "",
  mode: "config",
};
