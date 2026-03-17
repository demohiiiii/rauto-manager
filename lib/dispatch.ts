import type { DispatchType } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

const AGENT_API_KEY = process.env.AGENT_API_KEY;

// Map dispatch types to rauto Agent API endpoints
const DISPATCH_ENDPOINT_MAP: Record<DispatchType, string> = {
  exec: "/api/exec",
  template: "/api/template/execute",
  tx_block: "/api/tx/block",
  tx_workflow: "/api/tx/workflow",
  orchestrate: "/api/orchestrate",
};

// Timeout settings: exec is usually faster, other types may take longer
const DISPATCH_TIMEOUT_MAP: Record<DispatchType, number> = {
  exec: 30_000,
  template: 60_000,
  tx_block: 60_000,
  tx_workflow: 120_000,
  orchestrate: 120_000,
};

interface AgentInfo {
  host: string;
  port: number;
}

interface DispatchOptions {
  agent: AgentInfo;
  type: DispatchType;
  taskId: string;
  callbackUrl: string;
  connection?: Record<string, unknown>;
  payload: Record<string, unknown>;
  dryRun?: boolean;
  recordLevel?: string;
}

// RecordLevel uses PascalCase in Manager and kebab-case in rauto Agent
const RECORD_LEVEL_MAP: Record<string, string> = {
  Off: "off",
  KeyEventsOnly: "key-events-only",
  Full: "full",
};

/**
 * Build the full request payload sent to the agent.
 * Convert the Manager dispatch request into the format accepted by rauto Agent.
 */
function buildAgentPayload(options: DispatchOptions): Record<string, unknown> {
  const { type, taskId, callbackUrl, connection, payload, dryRun, recordLevel } = options;

  const base: Record<string, unknown> = {
    ...payload,
    task_id: taskId,
    callback_url: callbackUrl,
  };

  // Inject connection details for dispatch types that support the connection field
  if (connection && type !== "orchestrate") {
    base.connection = connection;
  }

  // Inject dry_run for dispatch types that support it
  if (dryRun !== undefined && type !== "exec") {
    base.dry_run = dryRun;
  }

  // Inject record_level after converting it to kebab-case
  if (recordLevel) {
    base.record_level = RECORD_LEVEL_MAP[recordLevel] ?? recordLevel;
  }

  return base;
}

/**
 * Send a dispatch request to the agent.
 * Return the agent response on success or throw on failure.
 */
export async function dispatchToAgent(
  options: DispatchOptions
): Promise<Record<string, unknown>> {
  const { agent, type } = options;

  const endpoint = DISPATCH_ENDPOINT_MAP[type];
  const timeoutMs = DISPATCH_TIMEOUT_MAP[type];
  const url = `http://${agent.host}:${agent.port}${endpoint}`;
  const body = buildAgentPayload(options);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_API_KEY && { Authorization: `Bearer ${AGENT_API_KEY}` }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const t = await getSystemTranslator();
    throw new Error(
      `Agent ${t(`tasks.dispatchType.${type}`)} 失败: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  return response.json();
}
