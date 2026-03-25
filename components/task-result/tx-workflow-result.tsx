import { useTranslations } from "next-intl";
import { CommandEchoTable } from "./command-echo-table";
import { TxStepResults } from "./tx-step-results";
import {
  KeyValueRow,
  MetaCard,
  MetaGrid,
  OutputBlock,
  SectionCard,
} from "./shared";
import {
  asArrayOfObjects,
  asBoolean,
  asNumber,
  asObject,
  asString,
  asStringArray,
} from "./result-helpers";

interface TxWorkflowResultProps {
  result: Record<string, unknown>;
}

function CommandList({ commands }: { commands: string[] }) {
  return (
    <div className="space-y-2">
      {commands.map((command, index) => (
        <div
          key={`${command}-${index}`}
          className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 rounded-md border border-border/60 px-3 py-2"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {index + 1}
          </span>
          <code className="text-xs font-mono break-all">{command}</code>
        </div>
      ))}
    </div>
  );
}

export function TxWorkflowResult({ result }: TxWorkflowResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const workflow = asObject(result.workflow);
  const workflowResult = asObject(result.tx_workflow_result);
  const recordingJsonl = asString(result.recording_jsonl);
  const topLevelError = asString(result.error);

  const workflowName =
    asString(workflowResult?.workflow_name) ?? asString(workflow?.name) ?? "—";
  const committed = asBoolean(workflowResult?.committed);
  const failedBlock =
    asString(workflowResult?.failed_block) ??
    (asNumber(workflowResult?.failed_block) !== undefined
      ? String((asNumber(workflowResult?.failed_block) ?? 0) + 1)
      : undefined);
  const rollbackAttempted = asBoolean(workflowResult?.rollback_attempted) ?? false;
  const rollbackSucceeded = asBoolean(workflowResult?.rollback_succeeded) ?? false;
  const rollbackErrors = Array.isArray(workflowResult?.rollback_errors)
    ? workflowResult.rollback_errors
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
    : [];
  const workflowBlocks = asArrayOfObjects(workflow?.blocks);
  const blockResults = asArrayOfObjects(workflowResult?.block_results);
  const totalBlocks = workflowBlocks.length || blockResults.length;

  const blockDefinitions = workflowBlocks.map((block, index) => {
    const name = asString(block.name) ?? `#${index + 1}`;
    const steps = Array.isArray(block.steps)
      ? block.steps
          .map((step) => asObject(step))
          .filter((step): step is Record<string, unknown> => step !== null)
      : [];
    const rollbackPolicy = asObject(block.rollback_policy);
    const commands = steps
      .map((step) => asString(step.command))
      .filter((command): command is string => Boolean(command));
    const rollbackCommands = [
      ...steps
        .map((step) => asString(step.rollback_command))
        .filter((command): command is string => Boolean(command)),
      ...(asString(rollbackPolicy?.undo_command)
        ? [asString(rollbackPolicy?.undo_command) as string]
        : []),
    ];
    const blockResult =
      blockResults.find((candidate) => asString(candidate.block_name) === name) ??
      blockResults[index] ??
      null;

    return {
      name,
      commands,
      rollbackCommands,
      blockResult,
    };
  });

  const additionalBlockResults = blockResults.filter((blockResult) => {
    const blockName = asString(blockResult.block_name);
    return !blockDefinitions.some((block) => block.name === blockName);
  });

  return (
    <div className="space-y-3">
      <MetaGrid>
        <MetaCard label={t("workflowName")} value={workflowName} />
        <MetaCard
          label={t("committed")}
          value={
            committed === undefined ? "—" : committed ? t("success") : t("failed")
          }
          variant={
            committed === undefined ? "default" : committed ? "success" : "error"
          }
        />
        <MetaCard label={t("totalBlocks")} value={totalBlocks} />
        {failedBlock && (
          <MetaCard
            label={t("failedBlock")}
            value={failedBlock}
            variant="error"
          />
        )}
        {rollbackAttempted && (
          <MetaCard
            label={t("rollbackAttempted")}
            value={
              rollbackSucceeded ? t("rollbackSucceeded") : t("rollbackFailed")
            }
            variant={rollbackSucceeded ? "warning" : "error"}
          />
        )}
      </MetaGrid>

      {blockDefinitions.map((block, index) => {
        const blockResult = block.blockResult;
        const blockCommitted = asBoolean(blockResult?.committed) ?? false;
        const executedSteps = asNumber(blockResult?.executed_steps) ?? 0;
        const failureReason = asString(blockResult?.failure_reason);
        const failedStep =
          asString(blockResult?.failed_step) ??
          (asNumber(blockResult?.failed_step) !== undefined
            ? String(asNumber(blockResult?.failed_step))
            : undefined);
        const blockRollbackErrors = asStringArray(blockResult?.rollback_errors);

        return (
          <SectionCard
            key={`${block.name}-${index}`}
            title={`${t("blockName")}: ${block.name}`}
            variant={blockCommitted ? "success" : "error"}
          >
            <div className="space-y-3">
              <MetaGrid>
                <MetaCard
                  label={t("committed")}
                  value={blockCommitted ? t("success") : t("failed")}
                  variant={blockCommitted ? "success" : "error"}
                />
                <MetaCard
                  label={t("executedSteps")}
                  value={`${executedSteps} / ${block.commands.length || executedSteps}`}
                />
                <MetaCard label={t("commands")} value={block.commands.length} />
                {block.rollbackCommands.length > 0 && (
                  <MetaCard
                    label={t("rollbackCommands")}
                    value={block.rollbackCommands.length}
                  />
                )}
              </MetaGrid>

              {block.commands.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("commands")}</div>
                  <CommandList commands={block.commands} />
                </div>
              )}

              {block.rollbackCommands.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {t("rollbackCommands")}
                  </div>
                  <CommandList commands={block.rollbackCommands} />
                </div>
              )}

              {(failedStep || failureReason) && (
                <div className="space-y-2">
                  {failedStep && (
                    <KeyValueRow label={t("failedStep")} value={failedStep} mono />
                  )}
                  {failureReason && (
                    <OutputBlock
                      content={failureReason}
                      maxHeight="160px"
                      isError
                    />
                  )}
                </div>
              )}

              {blockRollbackErrors.length > 0 && (
                <div className="space-y-2">
                  {blockRollbackErrors.map((error: string, errorIndex: number) => (
                    <OutputBlock
                      key={`${error}-${errorIndex}`}
                      content={error}
                      maxHeight="120px"
                      isError
                    />
                  ))}
                </div>
              )}

              <TxStepResults stepResults={blockResult?.step_results} />
            </div>
          </SectionCard>
        );
      })}

      {additionalBlockResults.map((blockResult, index) => {
        const blockName = asString(blockResult.block_name) ?? `#${index + 1}`;
        const blockCommitted = asBoolean(blockResult.committed) ?? false;
        const executedSteps = asNumber(blockResult.executed_steps) ?? 0;
        const failureReason = asString(blockResult.failure_reason);

        return (
          <SectionCard
            key={`${blockName}-extra-${index}`}
            title={`${t("blockName")}: ${blockName}`}
            variant={blockCommitted ? "success" : "error"}
          >
            <MetaGrid>
              <MetaCard
                label={t("committed")}
                value={blockCommitted ? t("success") : t("failed")}
                variant={blockCommitted ? "success" : "error"}
              />
              <MetaCard label={t("executedSteps")} value={executedSteps} />
            </MetaGrid>
            {failureReason && (
              <div className="mt-3">
                <OutputBlock content={failureReason} maxHeight="160px" isError />
              </div>
            )}
            <div className="mt-3">
              <TxStepResults stepResults={blockResult.step_results} />
            </div>
          </SectionCard>
        );
      })}

      {rollbackErrors.length > 0 && (
        <SectionCard title={t("rollbackErrors")} variant="error">
          <div className="space-y-2">
            {rollbackErrors.map((error: string, index: number) => (
              <OutputBlock
                key={`${error}-${index}`}
                content={error}
                maxHeight="120px"
                isError
              />
            ))}
          </div>
        </SectionCard>
      )}

      {topLevelError && !failedBlock && (
        <OutputBlock content={topLevelError} maxHeight="180px" isError />
      )}

      <SectionCard title={t("commandEchoes")}>
        <CommandEchoTable
          recordingJsonl={recordingJsonl}
          emptyText={t("noCommandEchoes")}
        />
      </SectionCard>
    </div>
  );
}
