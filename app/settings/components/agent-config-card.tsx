"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bot, Save, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

function safeNumber(value: string, fallback: number): number {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

export function AgentConfigCard({
  configs,
  onSave,
  isSaving,
  onSaveSuccess,
}: {
  configs: Record<string, string>;
  onSave: (updates: Record<string, string>) => void;
  isSaving: boolean;
  onSaveSuccess: boolean;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const heartbeatMs = safeNumber(configs["agent.heartbeat_interval"] ?? "30000", 30000);
  const timeoutMs = safeNumber(configs["agent.timeout"] ?? "120000", 120000);
  const systemNameRemote = configs["system.name"] ?? "Rauto Manager";

  const [systemName, setSystemName] = useState(systemNameRemote);
  const [heartbeat, setHeartbeat] = useState(String(heartbeatMs / 1000));
  const [timeout, setAgentTimeout] = useState(String(timeoutMs / 1000));
  const [dirty, setDirty] = useState(false);

  // Sync local state when remote data changes (and not dirty)
  useEffect(() => {
    if (!dirty) {
      setSystemName(systemNameRemote);
      setHeartbeat(String(heartbeatMs / 1000));
      setAgentTimeout(String(timeoutMs / 1000));
    }
  }, [systemNameRemote, heartbeatMs, timeoutMs, dirty]);

  // Reset dirty when save succeeds
  useEffect(() => {
    if (onSaveSuccess) {
      setDirty(false);
    }
  }, [onSaveSuccess]);

  const handleSave = () => {
    const hb = Number(heartbeat);
    const to = Number(timeout);

    if (isNaN(hb) || hb < 5 || hb > 300) {
      toast.error(t("heartbeatRangeError"));
      return;
    }
    if (isNaN(to) || to < 30 || to > 600) {
      toast.error(t("timeoutRangeError"));
      return;
    }
    if (!systemName.trim()) {
      toast.error(t("systemNameRequired"));
      return;
    }

    onSave({
      "system.name": systemName.trim(),
      "agent.heartbeat_interval": String(hb * 1000),
      "agent.timeout": String(to * 1000),
    });
  };

  return (
    <Card className="animate-fade-in stagger-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("agentConfig")}</CardTitle>
              <CardDescription>
                {t("agentConfigDescription")}
              </CardDescription>
            </div>
          </div>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {tc("save")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="system-name" className="text-sm font-medium">
              {t("systemName")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("systemNameDescription")}
            </p>
          </div>
          <Input
            id="system-name"
            className="w-48 text-right"
            value={systemName}
            onChange={(e) => {
              setSystemName(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="heartbeat-interval" className="text-sm font-medium">
              {t("heartbeatInterval")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("heartbeatIntervalDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="heartbeat-interval"
              className="w-20 text-right"
              type="number"
              min={5}
              max={300}
              value={heartbeat}
              onChange={(e) => {
                setHeartbeat(e.target.value);
                setDirty(true);
              }}
            />
            <span className="text-sm text-muted-foreground">{tc("secondsUnit")}</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="agent-timeout" className="text-sm font-medium">
              {t("agentTimeout")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("agentTimeoutDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="agent-timeout"
              className="w-20 text-right"
              type="number"
              min={30}
              max={600}
              value={timeout}
              onChange={(e) => {
                setAgentTimeout(e.target.value);
                setDirty(true);
              }}
            />
            <span className="text-sm text-muted-foreground">{tc("secondsUnit")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
