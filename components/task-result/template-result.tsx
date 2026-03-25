import { useTranslations } from "next-intl";
import {
  MetaCard,
  MetaGrid,
  StatusBadge,
  OutputBlock,
  SectionCard,
  KeyValueRow,
} from "./shared";
import { asNumber } from "./result-helpers";

interface CommandResult {
  command?: string;
  output?: string;
  error?: string;
  success?: boolean;
  status?: string;
  exit_code?: number;
}

interface TemplateResultData {
  total?: number;
  success_count?: number;
  failed_count?: number;
  rendered_commands?: string[] | string;
  results?: CommandResult[];
  output?: string;
  error?: string;
}

interface TemplateResultProps {
  result: Record<string, unknown>;
}

export function TemplateResult({ result }: TemplateResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const data = result as unknown as TemplateResultData;
  const total = data.total ?? data.results?.length ?? 0;
  const successCount =
    data.success_count ??
    data.results?.filter((r) => r.success !== false && r.status !== "failed")
      .length ??
    0;
  const failedCount = data.failed_count ?? total - successCount;

  const renderedCommands = data.rendered_commands;
  const results = data.results ?? [];

  return (
    <div className="space-y-3">
      {/* Summary metric grid */}
      <MetaGrid>
        <MetaCard label={t("total")} value={total} />
        <MetaCard
          label={t("success")}
          value={successCount}
          variant={successCount > 0 ? "success" : "default"}
        />
        <MetaCard
          label={t("failed")}
          value={failedCount}
          variant={failedCount > 0 ? "error" : "default"}
        />
      </MetaGrid>

      {/* Rendered command */}
      {renderedCommands && (
        <SectionCard title={t("renderedCommands")}>
          <OutputBlock
            content={
              Array.isArray(renderedCommands)
                ? renderedCommands.join("\n")
                : String(renderedCommands)
            }
            maxHeight="150px"
          />
        </SectionCard>
      )}

      {/* Per-command results */}
      {results.length > 0 && (
        <SectionCard title={t("commandResults")}>
          <div className="space-y-2">
            {results.map((r, i) => {
              const ok =
                r.success !== false && r.status !== "failed" && !r.error;
              return (
                <div
                  key={i}
                  className="rounded-md border p-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    {r.command && (
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate">
                        {r.command}
                      </code>
                    )}
                    <StatusBadge
                      status={ok ? "success" : "failed"}
                      label={ok ? t("success") : t("failed")}
                    />
                  </div>
                  {r.output && (
                    <OutputBlock content={r.output} maxHeight="100px" />
                  )}
                  {asNumber(r.exit_code) !== undefined && (
                    <KeyValueRow
                      label={t("exitCode")}
                      value={String(asNumber(r.exit_code))}
                      mono
                    />
                  )}
                  {r.error && (
                    <OutputBlock
                      content={r.error}
                      maxHeight="100px"
                      isError
                    />
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Aggregate output / error when per-command results are unavailable */}
      {results.length === 0 && data.output && (
        <OutputBlock content={data.output} maxHeight="300px" />
      )}
      {results.length === 0 && data.error && (
        <OutputBlock content={data.error} maxHeight="200px" isError />
      )}
    </div>
  );
}
