import { useTranslations } from "next-intl";
import {
  KeyValueRow,
  MetaCard,
  MetaGrid,
  OutputBlock,
  SectionCard,
  StatusBadge,
} from "./shared";
import { TxBlockResult } from "./tx-block-result";
import { TxWorkflowResult } from "./tx-workflow-result";
import {
  asArrayOfObjects,
  asBoolean,
  asNumber,
  asObject,
  asString,
} from "./result-helpers";

interface OrchestrateResultProps {
  result: Record<string, unknown>;
}

export function OrchestrateResult({ result }: OrchestrateResultProps) {
  const t = useTranslations("dialogs.taskResult");
  const tc = useTranslations("common");

  const plan = asObject(result.plan);
  const orchestrationResult = asObject(result.orchestration_result);
  const topLevelError = asString(result.error);

  const planName =
    asString(orchestrationResult?.plan_name) ?? asString(plan?.name) ?? "—";
  const success = asBoolean(orchestrationResult?.success);
  const totalStages = asNumber(orchestrationResult?.total_stages) ?? 0;
  const executedStages = asNumber(orchestrationResult?.executed_stages) ?? 0;
  const failFast =
    asBoolean(orchestrationResult?.fail_fast) ?? asBoolean(plan?.fail_fast);
  const stages = asArrayOfObjects(orchestrationResult?.stages);

  return (
    <div className="space-y-3">
      <MetaGrid>
        <MetaCard label={t("planName")} value={planName} />
        <MetaCard
          label={t("status")}
          value={
            success === undefined ? "—" : success ? t("success") : t("failed")
          }
          variant={
            success === undefined ? "default" : success ? "success" : "error"
          }
        />
        <MetaCard
          label={t("totalStages")}
          value={`${executedStages} / ${totalStages || executedStages}`}
        />
        {failFast !== undefined && (
          <MetaCard
            label={t("failFast")}
            value={failFast ? t("on") : t("off")}
            variant={failFast ? "warning" : "default"}
          />
        )}
      </MetaGrid>

      {stages.map((stage, stageIndex) => {
        const stageName = asString(stage.name) ?? `#${stageIndex + 1}`;
        const stageStatus = asString(stage.status) ?? "failed";
        const stageResults = asArrayOfObjects(stage.results);
        const stageOk = stageStatus === "success";
        const targetsTotal =
          asNumber(stage.targets_total) ?? stageResults.length;
        const targetsSucceeded = asNumber(stage.targets_succeeded) ?? 0;
        const targetsFailed = asNumber(stage.targets_failed) ?? 0;
        const targetsSkipped = asNumber(stage.targets_skipped) ?? 0;

        return (
          <SectionCard
            key={`${stageName}-${stageIndex}`}
            title={`${t("stageName")}: ${stageName}`}
            variant={stageOk ? "success" : "error"}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {asString(stage.strategy) && (
                  <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium">
                    {asString(stage.strategy)}
                  </span>
                )}
                <StatusBadge
                  status={stageOk ? "success" : "failed"}
                  label={stageOk ? t("success") : t("failed")}
                />
                {asString(stage.action_kind) && (
                  <span className="text-xs text-muted-foreground">
                    {asString(stage.action_kind)}
                  </span>
                )}
              </div>

              <MetaGrid>
                <MetaCard label={t("targetsTotal")} value={targetsTotal} />
                <MetaCard
                  label={t("targetsSucceeded")}
                  value={targetsSucceeded}
                  variant={targetsSucceeded > 0 ? "success" : "default"}
                />
                <MetaCard
                  label={t("targetsFailed")}
                  value={targetsFailed}
                  variant={targetsFailed > 0 ? "error" : "default"}
                />
                <MetaCard
                  label={t("targetsSkipped")}
                  value={targetsSkipped}
                  variant={targetsSkipped > 0 ? "warning" : "default"}
                />
              </MetaGrid>

              {asString(stage.action_summary) && (
                <KeyValueRow
                  label={t("actionSummary")}
                  value={asString(stage.action_summary) ?? "—"}
                />
              )}

              {stageResults.map((target, targetIndex) => {
                const targetLabel =
                  asString(target.label) ??
                  asString(target.connection_name) ??
                  `#${targetIndex + 1}`;
                const targetStatus = asString(target.status) ?? "failed";
                const targetOk = targetStatus === "success";
                const txResult = asObject(target.tx_result);
                const workflowResult = asObject(target.workflow_result);
                const targetError = asString(target.error);
                const recordingJsonl = asString(target.recording_jsonl);

                return (
                  <SectionCard
                    key={`${targetLabel}-${targetIndex}`}
                    title={`${t("targetLabel")}: ${targetLabel}`}
                    variant={
                      targetStatus === "skipped"
                        ? "default"
                        : targetOk
                          ? "success"
                          : "error"
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={
                            targetStatus === "skipped"
                              ? "skipped"
                              : targetOk
                                ? "success"
                                : "failed"
                          }
                          label={
                            targetStatus === "skipped"
                              ? t("skipped")
                              : targetOk
                                ? t("success")
                                : t("failed")
                          }
                        />
                        {asString(target.operation) && (
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            {asString(target.operation)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <KeyValueRow
                          label={t("connectionName")}
                          value={asString(target.connection_name) ?? "—"}
                          mono={Boolean(asString(target.connection_name))}
                        />
                        <KeyValueRow
                          label={t("host")}
                          value={asString(target.host) ?? "—"}
                          mono={Boolean(asString(target.host))}
                        />
                        <KeyValueRow
                          label={t("durationMs")}
                          value={
                            asNumber(target.duration_ms) !== undefined
                              ? `${asNumber(target.duration_ms)}ms`
                              : "—"
                          }
                        />
                      </div>

                      {txResult && (
                        <SectionCard title={tc("txBlock")}>
                          <TxBlockResult
                            result={{
                              tx_result: txResult,
                              recording_jsonl: recordingJsonl,
                              error: targetError,
                            }}
                          />
                        </SectionCard>
                      )}

                      {workflowResult && (
                        <SectionCard title={tc("txWorkflow")}>
                          <TxWorkflowResult
                            result={{
                              tx_workflow_result: workflowResult,
                              recording_jsonl: recordingJsonl,
                              error: targetError,
                            }}
                          />
                        </SectionCard>
                      )}

                      {!txResult && !workflowResult && targetError && (
                        <OutputBlock
                          content={targetError}
                          maxHeight="180px"
                          isError
                        />
                      )}
                    </div>
                  </SectionCard>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      {topLevelError && (
        <OutputBlock content={topLevelError} maxHeight="200px" isError />
      )}
    </div>
  );
}
