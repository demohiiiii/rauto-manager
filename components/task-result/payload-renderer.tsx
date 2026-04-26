import type { ConnectionPayload, DispatchType } from "@/lib/types";
import { useTranslations } from "next-intl";
import { SectionCard, KeyValueRow, OutputBlock } from "./shared";
import { asArrayOfObjects, asObject, asString } from "./result-helpers";

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
      <ConnectionCard
        connection={payload.connection as ConnectionPayload | undefined}
        t={t}
      />

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
  connection?: ConnectionPayload;
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
        {connection.username != null && (
          <KeyValueRow
            label={t("username")}
            value={String(connection.username)}
            mono
          />
        )}
        {connection.ssh_security != null && (
          <KeyValueRow
            label={t("sshSecurity")}
            value={String(connection.ssh_security)}
          />
        )}
        {connection.linux_shell_flavor != null && (
          <KeyValueRow
            label={t("linuxShellFlavor")}
            value={String(connection.linux_shell_flavor)}
          />
        )}
        {connection.template_dir != null && (
          <KeyValueRow
            label={t("templateDir")}
            value={String(connection.template_dir)}
            mono
          />
        )}
        {connection.enable_password_empty_enter !== undefined && (
          <KeyValueRow
            label={t("enablePasswordEmptyEnter")}
            value={connection.enable_password_empty_enter ? t("on") : t("off")}
          />
        )}
        {connection.enabled !== undefined && (
          <KeyValueRow
            label={t("enabled")}
            value={connection.enabled ? t("on") : t("off")}
          />
        )}
        {Array.isArray(connection.labels) && connection.labels.length > 0 && (
          <KeyValueRow
            label={t("labels")}
            value={connection.labels.join(", ")}
            mono
          />
        )}
        {Array.isArray(connection.groups) && connection.groups.length > 0 && (
          <KeyValueRow
            label={t("groups")}
            value={connection.groups.join(", ")}
            mono
          />
        )}
        {connection.vars != null && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">
              {t("variables")}:
            </span>
            <OutputBlock
              content={JSON.stringify(connection.vars, null, 2)}
              maxHeight="120px"
            />
          </div>
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
            <span className="text-xs text-muted-foreground">
              {t("variables")}:
            </span>
            <OutputBlock
              content={
                typeof vars === "string" ? vars : JSON.stringify(vars, null, 2)
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
  const vars = payload.vars;

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
        {payload.template != null && (
          <KeyValueRow
            label={t("templateName")}
            value={String(payload.template)}
            mono
          />
        )}
        {payload.template_profile != null && (
          <KeyValueRow
            label={t("templateProfile")}
            value={String(payload.template_profile)}
            mono
          />
        )}
        {payload.rollback_on_failure !== undefined && (
          <KeyValueRow
            label={t("rollbackOnFailure")}
            value={payload.rollback_on_failure ? "Yes" : "No"}
          />
        )}
        {payload.resource_rollback_command != null && (
          <KeyValueRow
            label={t("wholeResourceRollback")}
            value={String(payload.resource_rollback_command)}
            mono
          />
        )}
        {payload.rollback_trigger_step_index !== undefined && (
          <KeyValueRow
            label={t("triggerStep")}
            value={String(payload.rollback_trigger_step_index)}
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

        {vars != null && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">
              {t("variables")}:
            </span>
            <OutputBlock
              content={
                typeof vars === "string" ? vars : JSON.stringify(vars, null, 2)
              }
              maxHeight="120px"
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function TxWorkflowPayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const workflow = asObject(payload.workflow) ?? payload;
  const blocks = asArrayOfObjects(workflow.blocks);

  return (
    <div className="space-y-2">
      <SectionCard>
        <div className="space-y-0.5">
          {workflow.name != null && (
            <KeyValueRow
              label={t("workflowName")}
              value={String(workflow.name)}
              mono
            />
          )}
          {workflow.fail_fast !== undefined && (
            <KeyValueRow
              label={t("failFast")}
              value={workflow.fail_fast ? t("on") : t("off")}
            />
          )}
        </div>
      </SectionCard>

      {blocks.map((block, i) => (
        <SectionCard
          key={i}
          title={`${t("blockName")}: ${asString(block.name) ?? `#${i + 1}`}`}
        >
          <div className="space-y-1 text-sm">
            {block.kind != null && (
              <KeyValueRow label={t("kind")} value={String(block.kind)} />
            )}
            {block.fail_fast !== undefined && (
              <KeyValueRow
                label={t("failFast")}
                value={block.fail_fast ? t("on") : t("off")}
              />
            )}
            {block.rollback_policy != null && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("rollbackPolicy")}:
                </span>
                <OutputBlock
                  content={JSON.stringify(block.rollback_policy, null, 2)}
                  maxHeight="100px"
                />
              </div>
            )}
            {Array.isArray(block.steps) && block.steps.length > 0 && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("commands")} ({block.steps.length}):
                </span>
                <OutputBlock
                  content={JSON.stringify(block.steps, null, 2)}
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

function OrchestratePayload({
  payload,
  t,
}: {
  payload: Record<string, unknown>;
  t: TFunc;
}) {
  const tf = useTranslations("taskForms");
  const plan = asObject(payload.plan) ?? payload;
  const stages = asArrayOfObjects(plan.stages);

  return (
    <div className="space-y-2">
      <SectionCard>
        <div className="space-y-0.5">
          {plan.name != null && (
            <KeyValueRow label={t("planName")} value={String(plan.name)} mono />
          )}
          {plan.fail_fast !== undefined && (
            <KeyValueRow
              label={t("failFast")}
              value={plan.fail_fast ? t("on") : t("off")}
            />
          )}
          {plan.rollback_on_stage_failure !== undefined && (
            <KeyValueRow
              label={tf("rollbackOnStageFailure")}
              value={plan.rollback_on_stage_failure ? t("on") : t("off")}
            />
          )}
          {plan.rollback_completed_stages_on_failure !== undefined && (
            <KeyValueRow
              label={tf("rollbackCompletedStagesOnFailure")}
              value={
                plan.rollback_completed_stages_on_failure ? t("on") : t("off")
              }
            />
          )}
          {payload.base_dir != null && (
            <KeyValueRow
              label={t("baseDir")}
              value={String(payload.base_dir)}
              mono
            />
          )}
          {plan.inventory_file != null && (
            <KeyValueRow
              label={t("inventoryFile")}
              value={String(plan.inventory_file)}
              mono
            />
          )}
        </div>
      </SectionCard>

      {plan.inventory != null && (
        <SectionCard>
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">
              {t("inventory")}:
            </span>
            <OutputBlock
              content={JSON.stringify(plan.inventory, null, 2)}
              maxHeight="140px"
            />
          </div>
        </SectionCard>
      )}

      {stages.map((stage, i) => {
        const jobs = asArrayOfObjects(stage.jobs);

        return (
          <SectionCard
            key={i}
            title={`${t("stageName")}: ${asString(stage.name) ?? `#${i + 1}`}`}
          >
            <div className="space-y-3 text-sm">
              {stage.strategy != null && (
                <KeyValueRow
                  label={t("strategy")}
                  value={String(stage.strategy)}
                />
              )}
              {stage.max_parallel !== undefined && (
                <KeyValueRow
                  label={t("maxParallel")}
                  value={String(stage.max_parallel)}
                />
              )}
              {stage.fail_fast !== undefined && (
                <KeyValueRow
                  label={t("failFast")}
                  value={stage.fail_fast ? t("on") : t("off")}
                />
              )}
              <KeyValueRow label={t("jobsTotal")} value={jobs.length} />

              {jobs.map((job, jobIndex) => (
                <SectionCard
                  key={`${i}-${jobIndex}`}
                  title={`${t("jobName")}: ${asString(job.name) ?? `#${jobIndex + 1}`}`}
                >
                  <div className="space-y-1 text-sm">
                    {job.strategy != null && (
                      <KeyValueRow
                        label={t("strategy")}
                        value={String(job.strategy)}
                      />
                    )}
                    {job.max_parallel !== undefined && (
                      <KeyValueRow
                        label={t("maxParallel")}
                        value={String(job.max_parallel)}
                      />
                    )}
                    {job.fail_fast !== undefined && (
                      <KeyValueRow
                        label={t("failFast")}
                        value={job.fail_fast ? t("on") : t("off")}
                      />
                    )}
                    {Array.isArray(job.target_groups) &&
                      job.target_groups.length > 0 && (
                        <KeyValueRow
                          label={t("targetGroups")}
                          value={job.target_groups.join(", ")}
                          mono
                        />
                      )}
                    {Array.isArray(job.target_tags) &&
                      job.target_tags.length > 0 && (
                        <KeyValueRow
                          label={t("targetTags")}
                          value={job.target_tags.join(", ")}
                          mono
                        />
                      )}
                    {Array.isArray(job.targets) && job.targets.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground">
                          {t("targetLabel")}:
                        </span>
                        <OutputBlock
                          content={JSON.stringify(job.targets, null, 2)}
                          maxHeight="100px"
                        />
                      </div>
                    )}
                    {job.action != null && (
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground">
                          {t("actionSummary")}:
                        </span>
                        <OutputBlock
                          content={JSON.stringify(job.action, null, 2)}
                          maxHeight="100px"
                        />
                      </div>
                    )}
                  </div>
                </SectionCard>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
