import type { DispatchType } from "@/lib/types";
import { useTranslations } from "next-intl";
import {
  SectionCard,
  KeyValueRow,
  OutputBlock,
} from "./shared";

interface PayloadRendererProps {
  dispatchType: DispatchType;
  payload: Record<string, unknown>;
}

// Simplified translator type to avoid ReactNode incompatibilities from next-intl generics
type TFunc = (key: string) => string;

// Render payload inputs in a structured way based on the dispatch type
export function PayloadRenderer({
  dispatchType,
  payload,
}: PayloadRendererProps) {
  const rawT = useTranslations("dialogs.taskResult");
  const t = rawT as unknown as TFunc;

  return (
    <div className="space-y-3">
      {/* Connection details card */}
      <ConnectionCard connection={payload.connection as Record<string, unknown> | undefined} t={t} />

      {/* Render by dispatch type */}
      {dispatchType === "exec" && <ExecPayload payload={payload} t={t} />}
      {dispatchType === "template" && (
        <TemplatePayload payload={payload} t={t} />
      )}
      {dispatchType === "tx_block" && (
        <TxBlockPayload payload={payload} t={t} />
      )}
      {dispatchType === "tx_workflow" && (
        <TxWorkflowPayload payload={payload} t={t} />
      )}
      {dispatchType === "orchestrate" && (
        <OrchestratePayload payload={payload} t={t} />
      )}
    </div>
  );
}

// -- Connection details card -------------------------------------------------

function ConnectionCard({
  connection,
  t,
}: {
  connection?: Record<string, unknown>;
  t: TFunc;
}) {
  if (!connection) return null;

  return (
    <SectionCard title={t("connection")}>
      <div className="space-y-0.5">
        {connection.connection_name != null && (
          <KeyValueRow
            label={t("connectionName")}
            value={String(connection.connection_name)}
            mono
          />
        )}
        {connection.host != null && (
          <KeyValueRow
            label={t("host")}
            value={`${connection.host}${connection.port ? `:${connection.port}` : ""}`}
            mono
          />
        )}
        {connection.device_profile != null && (
          <KeyValueRow
            label={t("deviceType")}
            value={String(connection.device_profile)}
          />
        )}
      </div>
    </SectionCard>
  );
}

// ── Exec ──────────────────────────────────────────────────────────────
function ExecPayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  return (
    <SectionCard>
      <div className="space-y-0.5">
        {payload.command != null && (
          <KeyValueRow
            label={t("command")}
            value={String(payload.command)}
            mono
          />
        )}
        {payload.mode != null && (
          <KeyValueRow label={t("mode")} value={String(payload.mode)} />
        )}
      </div>
    </SectionCard>
  );
}

// ── Template ──────────────────────────────────────────────────────────
function TemplatePayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const vars = payload.vars ?? payload.variables;

  return (
    <SectionCard>
      <div className="space-y-1">
        {payload.template != null && (
          <KeyValueRow
            label={t("templateName")}
            value={String(payload.template)}
            mono
          />
        )}
        {payload.mode != null && (
          <KeyValueRow label={t("mode")} value={String(payload.mode)} />
        )}
        {payload.dry_run !== undefined && (
          <KeyValueRow
            label={t("dryRun")}
            value={payload.dry_run ? "Yes" : "No"}
          />
        )}
        {vars != null && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">{t("variables")}:</span>
            <OutputBlock
              content={
                typeof vars === "string"
                  ? vars
                  : JSON.stringify(vars, null, 2)
              }
              maxHeight="120px"
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── TxBlock ──────────────────────────────────────────────────────────
function TxBlockPayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const commands = payload.commands as string[] | undefined;
  const rollbackCommands = payload.rollback_commands as string[] | undefined;

  return (
    <SectionCard>
      <div className="space-y-1">
        {payload.name != null && (
          <KeyValueRow
            label={t("blockName")}
            value={String(payload.name)}
            mono
          />
        )}
        {payload.mode != null && (
          <KeyValueRow label={t("mode")} value={String(payload.mode)} />
        )}
        {payload.timeout_secs !== undefined && (
          <KeyValueRow
            label={t("timeout")}
            value={`${payload.timeout_secs}s`}
          />
        )}
        {payload.rollback_on_failure !== undefined && (
          <KeyValueRow
            label={t("rollbackOnFailure")}
            value={payload.rollback_on_failure ? "Yes" : "No"}
          />
        )}

        {commands != null && commands.length > 0 && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">
              {t("commands")} ({commands.length}):
            </span>
            <OutputBlock content={commands.join("\n")} maxHeight="120px" />
          </div>
        )}

        {rollbackCommands != null && rollbackCommands.length > 0 && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">
              {t("rollbackCommands")} ({rollbackCommands.length}):
            </span>
            <OutputBlock
              content={rollbackCommands.join("\n")}
              maxHeight="120px"
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── TxWorkflow ───────────────────────────────────────────────────────
interface WorkflowBlock {
  name?: string;
  kind?: string;
  mode?: string;
  commands?: string[];
  rollback_commands?: string[];
}

function TxWorkflowPayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const blocks = (payload.blocks ?? []) as WorkflowBlock[];

  return (
    <div className="space-y-2">
      <SectionCard>
        <div className="space-y-0.5">
          {payload.name != null && (
            <KeyValueRow
              label={t("workflowName")}
              value={String(payload.name)}
              mono
            />
          )}
          {payload.mode != null && (
            <KeyValueRow label={t("mode")} value={String(payload.mode)} />
          )}
          {payload.dry_run !== undefined && (
            <KeyValueRow
              label={t("dryRun")}
              value={payload.dry_run ? "Yes" : "No"}
            />
          )}
        </div>
      </SectionCard>

      {blocks.map((block, i) => (
        <SectionCard key={i} title={`${t("blockName")}: ${block.name ?? `#${i + 1}`}`}>
          <div className="space-y-1 text-sm">
            {block.kind != null && (
              <KeyValueRow label="Kind" value={block.kind} />
            )}
            {block.mode != null && (
              <KeyValueRow label={t("mode")} value={block.mode} />
            )}
            {block.commands != null && block.commands.length > 0 && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("commands")} ({block.commands.length}):
                </span>
                <OutputBlock
                  content={block.commands.join("\n")}
                  maxHeight="80px"
                />
              </div>
            )}
            {block.rollback_commands != null && block.rollback_commands.length > 0 && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("rollbackCommands")} ({block.rollback_commands.length}):
                </span>
                <OutputBlock
                  content={block.rollback_commands.join("\n")}
                  maxHeight="80px"
                />
              </div>
            )}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

// ── Orchestrate ──────────────────────────────────────────────────────
interface OrchestrateStage {
  name?: string;
  strategy?: string;
  action?: Record<string, unknown>;
  targets?: string[];
}

function OrchestratePayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const stages = (payload.stages ?? []) as OrchestrateStage[];

  return (
    <div className="space-y-2">
      {payload.plan_name != null && (
        <SectionCard>
          <KeyValueRow
            label={t("planName")}
            value={String(payload.plan_name)}
            mono
          />
        </SectionCard>
      )}

      {stages.map((stage, i) => (
        <SectionCard key={i} title={`${t("stageName")}: ${stage.name ?? `#${i + 1}`}`}>
          <div className="space-y-1 text-sm">
            {stage.strategy != null && (
              <KeyValueRow label={t("strategy")} value={stage.strategy} />
            )}
            {stage.targets != null && stage.targets.length > 0 && (
              <KeyValueRow
                label={t("targetLabel")}
                value={stage.targets.join(", ")}
                mono
              />
            )}
            {stage.action != null && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("actionSummary")}:
                </span>
                <OutputBlock
                  content={JSON.stringify(stage.action, null, 2)}
                  maxHeight="100px"
                />
              </div>
            )}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
