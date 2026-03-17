"use client";

import { useState } from "react";
import { Copy, Check, Terminal, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface RegisterAgentDialogProps {
  children: React.ReactNode;
}

export function RegisterAgentDialog({ children }: RegisterAgentDialogProps) {
  const t = useTranslations("dialogs");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Resolve the Manager URL from env vars or the current location
  const managerUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "http://localhost:3000";

  const apiKey = process.env.NEXT_PUBLIC_AGENT_API_KEY || "rauto-agent-api-key-change-in-production";

  // rauto registration command
  const registerCommand = `rauto agent \\
  --manager-url "${managerUrl}" \\
  --agent-name "my-agent" \\
  --agent-token "${apiKey}"`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registerCommand);
      setCopied(true);
      toast.success(t("commandCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t("registerAgentTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("registerAgentDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Configuration info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("managerConfig")}</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Manager URL:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">{managerUrl}</code>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">API Key:</span>
                <code className="text-xs bg-background px-2 py-1 rounded font-mono">
                  {apiKey.slice(0, 20)}...
                </code>
              </div>
            </div>
          </div>

          {/* Command preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{t("registerCommand")}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    <span className="text-xs">{t("copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-xs">{t("copyCommand")}</span>
                  </>
                )}
              </Button>
            </div>
            <div className="relative">
              <pre className="p-4 rounded-lg bg-muted/50 border overflow-x-auto text-xs font-mono leading-relaxed">
                {registerCommand}
              </pre>
            </div>
          </div>

          {/* Parameter notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("parameterDescription")}</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono">--manager-url</Badge>
                <span>{t("managerUrlDescription")}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono">--agent-name</Badge>
                <span>{t("agentNameDescription")}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono">--agent-token</Badge>
                <span>{t("agentTokenDescription")}</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <div className="flex gap-2 text-sm">
              <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  {t("executionSteps")}
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t("step1")}</li>
                  <li>{t("step2")}</li>
                  <li>{t("step3")}</li>
                  <li>{t("step4")}</li>
                  <li>{t("step5")}</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Documentation link */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {t("needHelp")}
            </span>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <ExternalLink className="h-3 w-3" />
              {t("viewDocs")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
