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

type ReportMode = "http" | "grpc";

export function RegisterAgentDialog({ children }: RegisterAgentDialogProps) {
  const t = useTranslations("dialogs");
  const [open, setOpen] = useState(false);
  const [copiedMode, setCopiedMode] = useState<ReportMode | null>(null);
  const [selectedMode, setSelectedMode] = useState<ReportMode>("http");

  const httpManagerUrl =
    process.env.NEXT_PUBLIC_MANAGER_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000");

  const grpcManagerUrl =
    process.env.NEXT_PUBLIC_MANAGER_GRPC_URL ||
    (() => {
      try {
        const parsed = new URL(httpManagerUrl);
        return `${parsed.protocol}//${parsed.hostname}:50051`;
      } catch {
        return "http://localhost:50051";
      }
    })();

  const apiKey = process.env.NEXT_PUBLIC_AGENT_API_KEY || "rauto-agent-api-key-change-in-production";

  const commands: Array<{
    mode: ReportMode;
    title: string;
    description: string;
    managerUrl: string;
    command: string;
    note?: string;
  }> = [
    {
      mode: "http",
      title: t("reportModeHttp"),
      description: t("registerAgentHttpDescription"),
      managerUrl: httpManagerUrl,
      command: `rauto agent \\
  --manager-url "${httpManagerUrl}" \\
  --report-mode "http" \\
  --agent-name "my-agent" \\
  --agent-token "${apiKey}"`,
      note: t("httpModeNote"),
    },
    {
      mode: "grpc",
      title: t("reportModeGrpc"),
      description: t("registerAgentGrpcDescription"),
      managerUrl: grpcManagerUrl,
      command: `rauto agent \\
  --manager-url "${grpcManagerUrl}" \\
  --report-mode "grpc" \\
  --agent-name "my-agent" \\
  --agent-token "${apiKey}"`,
      note: t("grpcModeNote"),
    },
  ];

  const selectedCommand =
    commands.find((item) => item.mode === selectedMode) ?? commands[0];

  const handleCopy = async (command: string, mode: ReportMode) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedMode(mode);
      toast.success(t("commandCopied"));
      setTimeout(() => {
        setCopiedMode((current) => (current === mode ? null : current));
      }, 2000);
    } catch (error) {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0 sm:max-h-[88vh]">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Terminal className="h-5 w-5" />
              {t("registerAgentTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("registerAgentDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-medium">{t("reportModeLabel")}</h4>
              <div className="inline-flex rounded-xl border bg-muted/40 p-1">
                {commands.map((item) => {
                  const isActive = item.mode === selectedMode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setSelectedMode(item.mode)}
                      className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20">
              <div className="space-y-3 border-b p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{selectedCommand.title}</h4>
                      <Badge variant="outline" className="font-mono uppercase">
                        {selectedCommand.mode}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedCommand.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(selectedCommand.command, selectedCommand.mode)
                    }
                    className="h-8 gap-2 shrink-0"
                  >
                    {copiedMode === selectedCommand.mode ? (
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

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-background/70 p-2">
                    <div className="text-xs text-muted-foreground">
                      {t("managerUrlLabel")}
                    </div>
                    <code className="mt-1 block truncate rounded bg-background px-2 py-1 text-xs">
                      {selectedCommand.managerUrl}
                    </code>
                  </div>
                  <div className="rounded-lg bg-background/70 p-2">
                    <div className="text-xs text-muted-foreground">
                      {t("reportModeLabel")}
                    </div>
                    <code className="mt-1 inline-flex rounded bg-background px-2 py-1 text-xs">
                      {selectedCommand.mode}
                    </code>
                  </div>
                  <div className="rounded-lg bg-background/70 p-2 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">API Key</div>
                    <code className="mt-1 block truncate rounded bg-background px-2 py-1 font-mono text-xs">
                      {apiKey.slice(0, 20)}...
                    </code>
                  </div>
                </div>

                {selectedCommand.note ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedCommand.note}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 p-4">
                <h5 className="text-sm font-medium">{t("registerCommand")}</h5>
                <pre className="overflow-x-auto rounded-lg border bg-background/70 p-4 text-xs font-mono leading-relaxed">
                  {selectedCommand.command}
                </pre>
              </div>
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
                <Badge variant="outline" className="font-mono">--report-mode</Badge>
                <span>{t("reportModeDescription")}</span>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
