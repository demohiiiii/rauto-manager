import { AUTO_PROFILE_MODE } from "@/lib/profile-mode";

function parseCommands(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function parseOptionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function buildRunCommand(mode: string, command: string, timeout?: number) {
  return {
    kind: "command",
    mode,
    command,
    ...(timeout !== undefined ? { timeout } : {}),
  };
}

export function hasTxBlockDispatchInput(
  payload: Record<string, unknown>,
): boolean {
  const txBlock = parseRecord(payload.tx_block);
  if (txBlock && Array.isArray(txBlock.steps) && txBlock.steps.length > 0) {
    return true;
  }

  if (parseCommands(payload.commands).length > 0) {
    return true;
  }

  return Boolean(
    parseOptionalString(payload.template) ??
    parseOptionalString(payload.template_content),
  );
}

export function buildTxBlockJsonFromPayload(
  payload: Record<string, unknown>,
): string {
  const existingTxBlock = parseRecord(payload.tx_block);
  if (existingTxBlock) {
    return JSON.stringify(existingTxBlock);
  }

  if (!hasTxBlockDispatchInput(payload)) {
    throw new Error(
      "tx_block payload must include non-empty tx_block, commands, template, or template_content",
    );
  }

  const name = parseOptionalString(payload.name) ?? "tx-block";
  const mode = parseOptionalString(payload.mode);
  const normalizedMode = mode && mode !== AUTO_PROFILE_MODE ? mode : "Enable";
  const timeout = parseOptionalPositiveInteger(payload.timeout_secs);
  const failFast = true;
  const rollbackOnFailure = payload.rollback_on_failure === true;
  const commands = parseCommands(payload.commands);
  const rollbackCommands = parseCommands(payload.rollback_commands);
  const resourceRollbackCommand = parseOptionalString(
    payload.resource_rollback_command,
  );
  const rollbackTriggerStepIndex =
    parseOptionalNonNegativeInteger(payload.rollback_trigger_step_index) ?? 0;

  const steps = commands.map((command, index) => ({
    run: buildRunCommand(normalizedMode, command, timeout),
    rollback:
      rollbackCommands[index] && rollbackCommands[index].trim()
        ? buildRunCommand(normalizedMode, rollbackCommands[index], timeout)
        : null,
    rollback_on_failure: rollbackOnFailure,
  }));

  const txBlock: Record<string, unknown> = {
    name,
    fail_fast: failFast,
    steps,
  };

  if (resourceRollbackCommand) {
    txBlock.rollback_policy = {
      whole_resource: {
        rollback: buildRunCommand(
          normalizedMode,
          resourceRollbackCommand,
          timeout,
        ),
        trigger_step_index: rollbackTriggerStepIndex,
      },
    };
  } else if (commands.length > 0) {
    txBlock.rollback_policy = "per_step";
  } else {
    txBlock.rollback_policy = "none";
  }

  return JSON.stringify(txBlock);
}
