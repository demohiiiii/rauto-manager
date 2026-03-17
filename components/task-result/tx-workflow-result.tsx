import { useTranslations } from "next-intl";
import { MetaCard, MetaGrid, SectionCard, OutputBlock } from "./shared";
import { TxBlockResult } from "./tx-block-result";

interface BlockResult {
  name?: string;
  committed?: boolean;
  executed_steps?: number;
  total_steps?: number;
  rollback_attempted?: boolean;
  rollback_succeeded?: boolean;
  failed_step?: string | number;
  failure_reason?: string;
  rollback_errors?: string[];
  [key: string]: unknown;
}

interface TxWorkflowResultData {
  workflow_name?: string;
  committed?: boolean;
  rollback_attempted?: boolean;
  rollback_succeeded?: boolean;
  blocks?: BlockResult[];
  output?: string;
  error?: string;
}

interface TxWorkflowResultProps {
  result: Record<string, unknown>;
}

export function TxWorkflowResult({ result }: TxWorkflowResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const data = result as unknown as TxWorkflowResultData;

  const workflowName = data.workflow_name ?? "—";
  const committed = data.committed ?? false;
  const rollbackAttempted = data.rollback_attempted ?? false;
  const rollbackSucceeded = data.rollback_succeeded ?? false;
  const blocks = data.blocks ?? [];

  return (
    <div className="space-y-3">
      {/* Summary */}
      <MetaGrid>
        <MetaCard label={t("workflowName")} value={workflowName} />
        <MetaCard
          label={t("committed")}
          value={committed ? "Yes" : "No"}
          variant={committed ? "success" : "error"}
        />
        {rollbackAttempted && (
          <MetaCard
            label={t("rollbackAttempted")}
            value={rollbackSucceeded ? t("rollbackSucceeded") : t("rollbackFailed")}
            variant={rollbackSucceeded ? "warning" : "error"}
          />
        )}
      </MetaGrid>

      {/* Per-block results */}
      {blocks.map((block, i) => (
        <SectionCard
          key={i}
          title={`${t("blockName")}: ${block.name ?? `#${i + 1}`}`}
          variant={block.committed === false ? "error" : "success"}
        >
          <TxBlockResult result={block as unknown as Record<string, unknown>} />
        </SectionCard>
      ))}

      {/* Aggregate output */}
      {data.output && <OutputBlock content={data.output} maxHeight="200px" />}
      {data.error && (
        <OutputBlock content={data.error} maxHeight="200px" isError />
      )}
    </div>
  );
}
