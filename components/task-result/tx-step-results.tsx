import { useTranslations } from "next-intl";
import { KeyValueRow, OutputBlock, SectionCard } from "./shared";
import {
  asArrayOfObjects,
  asNumber,
  asString,
} from "./result-helpers";

interface TxStepResultsProps {
  stepResults: unknown;
}

export function TxStepResults({ stepResults }: TxStepResultsProps) {
  const t = useTranslations("dialogs.taskResult");
  const steps = asArrayOfObjects(stepResults);

  if (steps.length === 0) {
    return null;
  }

  return (
    <SectionCard title={t("stepResults")}>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const stepIndex = asNumber(step.step_index);
          const command = asString(step.command);
          const mode = asString(step.mode);
          const executionState = asString(step.execution_state);
          const failureReason = asString(step.failure_reason);
          const rollbackState = asString(step.rollback_state);
          const rollbackCommand = asString(step.rollback_command);
          const rollbackReason = asString(step.rollback_reason);

          return (
            <div
              key={`${stepIndex ?? index}-${command ?? "step"}`}
              className="rounded-md border border-border/60 px-3 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {t("stepIndex")} {stepIndex !== undefined ? stepIndex + 1 : index + 1}
                </div>
                {executionState && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {executionState}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {command && (
                  <KeyValueRow
                    label={t("command")}
                    value={command}
                    mono
                  />
                )}
                {mode && (
                  <KeyValueRow
                    label={t("mode")}
                    value={mode}
                    mono
                  />
                )}
                {executionState && (
                  <KeyValueRow
                    label={t("executionState")}
                    value={executionState}
                    mono
                  />
                )}
                {rollbackState && (
                  <KeyValueRow
                    label={t("rollbackState")}
                    value={rollbackState}
                    mono
                  />
                )}
              </div>

              {failureReason && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {t("failureReason")}
                  </div>
                  <OutputBlock content={failureReason} maxHeight="120px" isError />
                </div>
              )}

              {rollbackCommand && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {t("rollbackCommand")}
                  </div>
                  <OutputBlock content={rollbackCommand} maxHeight="120px" />
                </div>
              )}

              {rollbackReason && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {t("rollbackReason")}
                  </div>
                  <OutputBlock content={rollbackReason} maxHeight="120px" isError />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
