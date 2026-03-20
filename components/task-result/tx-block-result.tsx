import { useTranslations } from "next-intl";
import { CommandEchoTable } from "./command-echo-table";
import {
  KeyValueRow,
  MetaCard,
  MetaGrid,
  OutputBlock,
  SectionCard,
} from "./shared";
import {
  asBoolean,
  asNumber,
  asObject,
  asString,
  asStringArray,
} from "./result-helpers";

interface TxBlockResultProps {
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

export function TxBlockResult({ result }: TxBlockResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const txBlock = asObject(result.tx_block);
  const txResult = asObject(result.tx_result);
  const recordingJsonl = asString(result.recording_jsonl);
  const topLevelError = asString(result.error);
  const steps = Array.isArray(txBlock?.steps)
    ? txBlock.steps
        .map((step) => asObject(step))
        .filter((step): step is Record<string, unknown> => step !== null)
    : [];
  const rollbackPolicy = asObject(txBlock?.rollback_policy);

  const blockName =
    asString(txResult?.block_name) ?? asString(txBlock?.name) ?? "—";
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
  const committed = asBoolean(txResult?.committed);
  const executedSteps = asNumber(txResult?.executed_steps) ?? 0;
  const totalSteps = steps.length || executedSteps;
  const rollbackAttempted = asBoolean(txResult?.rollback_attempted) ?? false;
  const rollbackSucceeded = asBoolean(txResult?.rollback_succeeded) ?? false;
  const failedStep =
    asString(txResult?.failed_step) ??
    (asNumber(txResult?.failed_step) !== undefined
      ? String(asNumber(txResult?.failed_step))
      : undefined);
  const failureReason = asString(txResult?.failure_reason) ?? topLevelError;
  const rollbackErrors = asStringArray(txResult?.rollback_errors);
  const executionMode =
    asString(steps[0]?.mode) ?? asString(rollbackPolicy?.mode);

  return (
    <div className="space-y-3">
      <MetaGrid>
        <MetaCard label={t("blockName")} value={blockName} />
        <MetaCard
          label={t("committed")}
          value={
            committed === undefined ? "—" : committed ? t("success") : t("failed")
          }
          variant={
            committed === undefined ? "default" : committed ? "success" : "error"
          }
        />
        <MetaCard
          label={t("executedSteps")}
          value={`${executedSteps} / ${totalSteps || executedSteps}`}
        />
        <MetaCard
          label={t("commands")}
          value={commands.length || totalSteps || "—"}
        />
        {rollbackCommands.length > 0 && (
          <MetaCard
            label={t("rollbackCommands")}
            value={rollbackCommands.length}
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

      <SectionCard title={t("status")}>
        <div className="space-y-1">
          <KeyValueRow label={t("blockName")} value={blockName} />
          <KeyValueRow
            label={t("mode")}
            value={executionMode ?? "—"}
            mono={Boolean(executionMode)}
          />
          <KeyValueRow
            label={t("rollbackAttempted")}
            value={rollbackAttempted ? t("success") : "—"}
          />
        </div>
      </SectionCard>

      {commands.length > 0 && (
        <SectionCard title={t("commands")}>
          <CommandList commands={commands} />
        </SectionCard>
      )}

      {rollbackCommands.length > 0 && (
        <SectionCard title={t("rollbackCommands")}>
          <CommandList commands={rollbackCommands} />
        </SectionCard>
      )}

      {(failedStep || failureReason) && (
        <SectionCard title={t("failedStep")} variant="error">
          <div className="space-y-2 text-sm">
            {failedStep && (
              <KeyValueRow label={t("failedStep")} value={failedStep} mono />
            )}
            {failureReason && (
              <OutputBlock content={failureReason} maxHeight="160px" isError />
            )}
          </div>
        </SectionCard>
      )}

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

      <SectionCard title={t("commandEchoes")}>
        <CommandEchoTable
          recordingJsonl={recordingJsonl}
          emptyText={t("noCommandEchoes")}
        />
      </SectionCard>
    </div>
  );
}
