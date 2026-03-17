import { useTranslations } from "next-intl";
import {
  MetaCard,
  MetaGrid,
  StatusBadge,
  SectionCard,
  KeyValueRow,
  OutputBlock,
} from "./shared";

interface TargetResult {
  label?: string;
  host?: string;
  connection_name?: string;
  status?: string;
  success?: boolean;
  operation?: string;
  duration_ms?: number;
  output?: string;
  error?: string;
}

interface StageResult {
  name?: string;
  strategy?: string;
  status?: string;
  success?: boolean;
  action_summary?: string;
  targets?: TargetResult[];
  error?: string;
}

interface OrchestrateResultData {
  plan_name?: string;
  success?: boolean;
  total_stages?: number;
  executed_stages?: number;
  fail_fast?: boolean;
  stages?: StageResult[];
  output?: string;
  error?: string;
}

interface OrchestrateResultProps {
  result: Record<string, unknown>;
}

export function OrchestrateResult({ result }: OrchestrateResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const data = result as unknown as OrchestrateResultData;

  const planName = data.plan_name ?? "—";
  const success = data.success ?? false;
  const totalStages = data.total_stages ?? data.stages?.length ?? 0;
  const executedStages = data.executed_stages ?? 0;
  const failFast = data.fail_fast;
  const stages = data.stages ?? [];

  return (
    <div className="space-y-3">
      {/* 摘要 */}
      <MetaGrid>
        <MetaCard label={t("planName")} value={planName} />
        <MetaCard
          label={t("success")}
          value={success ? "Yes" : "No"}
          variant={success ? "success" : "error"}
        />
        <MetaCard
          label={t("totalStages")}
          value={`${executedStages} / ${totalStages}`}
        />
        {failFast !== undefined && (
          <MetaCard
            label={t("failFast")}
            value={failFast ? "On" : "Off"}
            variant={failFast ? "warning" : "default"}
          />
        )}
      </MetaGrid>

      {/* 逐阶段卡片 */}
      {stages.map((stage, i) => {
        const stageOk =
          stage.success !== false && stage.status !== "failed";
        const targets = stage.targets ?? [];

        return (
          <SectionCard
            key={i}
            title={`${t("stageName")}: ${stage.name ?? `#${i + 1}`}`}
            variant={stageOk ? "success" : "error"}
          >
            <div className="space-y-2">
              {/* Stage 元信息 */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {stage.strategy && (
                  <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium">
                    {stage.strategy}
                  </span>
                )}
                <StatusBadge
                  status={stageOk ? "success" : "failed"}
                  label={stageOk ? t("success") : t("failed")}
                />
                {stage.action_summary && (
                  <span className="text-muted-foreground text-xs">
                    {stage.action_summary}
                  </span>
                )}
              </div>

              {/* Target 列表 */}
              {targets.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left px-2 py-1.5 font-medium">
                          {t("targetLabel")}
                        </th>
                        <th className="text-left px-2 py-1.5 font-medium">
                          {t("host")}
                        </th>
                        <th className="text-left px-2 py-1.5 font-medium">
                          {t("status")}
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium">
                          {t("durationMs")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((tgt, j) => {
                        const tgtOk =
                          tgt.success !== false && tgt.status !== "failed";
                        return (
                          <tr
                            key={j}
                            className="border-t border-border/50"
                          >
                            <td className="px-2 py-1.5 font-mono">
                              {tgt.label ?? tgt.connection_name ?? `#${j + 1}`}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {tgt.host ?? "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <StatusBadge
                                status={tgtOk ? "success" : "failed"}
                                label={tgtOk ? t("success") : t("failed")}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {tgt.duration_ms != null
                                ? `${tgt.duration_ms}ms`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stage 错误 */}
              {stage.error && (
                <OutputBlock
                  content={stage.error}
                  maxHeight="100px"
                  isError
                />
              )}
            </div>
          </SectionCard>
        );
      })}

      {/* 整体输出 */}
      {data.output && <OutputBlock content={data.output} maxHeight="200px" />}
      {data.error && (
        <OutputBlock content={data.error} maxHeight="200px" isError />
      )}
    </div>
  );
}
