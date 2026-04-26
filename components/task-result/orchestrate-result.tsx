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
        const stageJobs = asArrayOfObjects(stage.jobs);
        const stageOk = stageStatus === "success";
        const jobsTotal = asNumber(stage.jobs_total) ?? stageJobs.length;
        const jobsSucceeded = asNumber(stage.jobs_succeeded) ?? 0;
        const jobsFailed = asNumber(stage.jobs_failed) ?? 0;
        const jobsSkipped = asNumber(stage.jobs_skipped) ?? 0;

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
              </div>

              <MetaGrid>
                <MetaCard label={t("jobsTotal")} value={jobsTotal} />
                <MetaCard
                  label={t("jobsSucceeded")}
                  value={jobsSucceeded}
                  variant={jobsSucceeded > 0 ? "success" : "default"}
                />
                <MetaCard
                  label={t("jobsFailed")}
                  value={jobsFailed}
                  variant={jobsFailed > 0 ? "error" : "default"}
                />
                <MetaCard
                  label={t("jobsSkipped")}
                  value={jobsSkipped}
                  variant={jobsSkipped > 0 ? "warning" : "default"}
                />
              </MetaGrid>

              {stageJobs.map((job, jobIndex) => {
                const jobName = asString(job.name) ?? `#${jobIndex + 1}`;
                const jobStatus = asString(job.status) ?? "failed";
                const jobResults = asArrayOfObjects(job.results);
                const jobOk = jobStatus === "success";
                const targetsTotal =
                  asNumber(job.targets_total) ?? jobResults.length;
                const targetsSucceeded = asNumber(job.targets_succeeded) ?? 0;
                const targetsFailed = asNumber(job.targets_failed) ?? 0;
                const targetsSkipped = asNumber(job.targets_skipped) ?? 0;

                return (
                  <SectionCard
                    key={`${stageName}-${jobName}-${jobIndex}`}
                    title={`${t("jobName")}: ${jobName}`}
                    variant={
                      jobStatus === "skipped"
                        ? "default"
                        : jobOk
                          ? "success"
                          : "error"
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {asString(job.strategy) && (
                          <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium">
                            {asString(job.strategy)}
                          </span>
                        )}
                        <StatusBadge
                          status={
                            jobStatus === "skipped"
                              ? "skipped"
                              : jobOk
                                ? "success"
                                : "failed"
                          }
                          label={
                            jobStatus === "skipped"
                              ? t("skipped")
                              : jobOk
                                ? t("success")
                                : t("failed")
                          }
                        />
                        {asString(job.action_kind) && (
                          <span className="text-xs text-muted-foreground">
                            {asString(job.action_kind)}
                          </span>
                        )}
                      </div>

                      <MetaGrid>
                        <MetaCard
                          label={t("targetsTotal")}
                          value={targetsTotal}
                        />
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

                      {asString(job.action_summary) && (
                        <KeyValueRow
                          label={t("actionSummary")}
                          value={asString(job.action_summary) ?? "—"}
                        />
                      )}

                      {jobResults.map((target, targetIndex) => {
                        const targetLabel =
                          asString(target.label) ??
                          asString(target.connection_name) ??
                          `#${targetIndex + 1}`;
                        const targetStatus =
                          asString(target.status) ?? "failed";
                        const targetOk = targetStatus === "success";
                        const txResult = asObject(target.tx_result);
                        const workflowResult = asObject(target.workflow_result);
                        const compensation = asObject(target.compensation);
                        const compensationTxResult = asObject(
                          compensation?.tx_result,
                        );
                        const targetError = asString(target.error);
                        const recordingJsonl = asString(target.recording_jsonl);
                        const compensationError = asString(compensation?.error);
                        const compensationRecordingJsonl = asString(
                          compensation?.recording_jsonl,
                        );
                        const compensationSuccess = asBoolean(
                          compensation?.success,
                        );
                        const compensationAttempted = asBoolean(
                          compensation?.attempted,
                        );

                        return (
                          <SectionCard
                            key={`${jobName}-${targetLabel}-${targetIndex}`}
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
                                  value={
                                    asString(target.connection_name) ?? "—"
                                  }
                                  mono={Boolean(
                                    asString(target.connection_name),
                                  )}
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

                              {compensation && (
                                <SectionCard title={t("compensation")}>
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <KeyValueRow
                                        label={t("attempted")}
                                        value={
                                          compensationAttempted === undefined
                                            ? "—"
                                            : compensationAttempted
                                              ? t("on")
                                              : t("off")
                                        }
                                      />
                                      <KeyValueRow
                                        label={t("status")}
                                        value={
                                          compensationSuccess === undefined
                                            ? "—"
                                            : compensationSuccess
                                              ? t("success")
                                              : t("failed")
                                        }
                                      />
                                      <KeyValueRow
                                        label={t("scope")}
                                        value={
                                          asString(compensation.scope) ?? "—"
                                        }
                                      />
                                      <KeyValueRow
                                        label={t("reason")}
                                        value={
                                          asString(compensation.reason) ?? "—"
                                        }
                                      />
                                      <KeyValueRow
                                        label={t("operation")}
                                        value={
                                          asString(compensation.operation) ??
                                          "—"
                                        }
                                      />
                                      <KeyValueRow
                                        label={t("durationMs")}
                                        value={
                                          asNumber(compensation.duration_ms) !==
                                          undefined
                                            ? `${asNumber(compensation.duration_ms)}ms`
                                            : "—"
                                        }
                                      />
                                    </div>

                                    {compensationTxResult && (
                                      <SectionCard title={tc("txBlock")}>
                                        <TxBlockResult
                                          result={{
                                            tx_result: compensationTxResult,
                                            recording_jsonl:
                                              compensationRecordingJsonl,
                                            error: compensationError,
                                          }}
                                        />
                                      </SectionCard>
                                    )}

                                    {!compensationTxResult &&
                                      compensationError && (
                                        <OutputBlock
                                          content={compensationError}
                                          maxHeight="180px"
                                          isError
                                        />
                                      )}
                                  </div>
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
