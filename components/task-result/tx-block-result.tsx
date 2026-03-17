import { useTranslations } from "next-intl";
import { MetaCard, MetaGrid, OutputBlock, SectionCard } from "./shared";

interface TxBlockResultData {
  committed?: boolean;
  executed_steps?: number;
  total_steps?: number;
  rollback_attempted?: boolean;
  rollback_succeeded?: boolean;
  failed_step?: string | number;
  failure_reason?: string;
  rollback_errors?: string[];
  output?: string;
  error?: string;
}

interface TxBlockResultProps {
  result: Record<string, unknown>;
}

export function TxBlockResult({ result }: TxBlockResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const data = result as unknown as TxBlockResultData;

  const committed = data.committed ?? false;
  const executedSteps = data.executed_steps ?? 0;
  const totalSteps = data.total_steps ?? 0;
  const rollbackAttempted = data.rollback_attempted ?? false;
  const rollbackSucceeded = data.rollback_succeeded ?? false;

  return (
    <div className="space-y-3">
      {/* 摘要指标 */}
      <MetaGrid>
        <MetaCard
          label={t("committed")}
          value={committed ? "Yes" : "No"}
          variant={committed ? "success" : "error"}
        />
        <MetaCard
          label={t("executedSteps")}
          value={`${executedSteps} / ${totalSteps}`}
        />
        {rollbackAttempted && (
          <MetaCard
            label={t("rollbackAttempted")}
            value={rollbackSucceeded ? t("rollbackSucceeded") : t("rollbackFailed")}
            variant={rollbackSucceeded ? "warning" : "error"}
          />
        )}
      </MetaGrid>

      {/* 失败信息 */}
      {data.failed_step !== undefined && (
        <SectionCard title={t("failedStep")} variant="error">
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">{t("failedStep")}:</span>{" "}
              <span className="font-mono">{String(data.failed_step)}</span>
            </div>
            {data.failure_reason && (
              <OutputBlock
                content={data.failure_reason}
                maxHeight="150px"
                isError
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* 回滚错误 */}
      {data.rollback_errors && data.rollback_errors.length > 0 && (
        <SectionCard title={t("rollbackErrors")} variant="error">
          <div className="space-y-1">
            {data.rollback_errors.map((err, i) => (
              <OutputBlock key={i} content={err} maxHeight="80px" isError />
            ))}
          </div>
        </SectionCard>
      )}

      {/* 整体输出 */}
      {data.output && <OutputBlock content={data.output} maxHeight="200px" />}
      {data.error && !data.failure_reason && (
        <OutputBlock content={data.error} maxHeight="200px" isError />
      )}
    </div>
  );
}
