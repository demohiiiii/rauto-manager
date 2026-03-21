import { dispatchTaskOverGrpc } from "@/lib/agent-task-grpc";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import { getDefaultRecordLevelForType } from "@/lib/record-level";
import type { AgentReportMode, DispatchType } from "@/lib/types";

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const ASYNC_DISPATCH_TYPES = new Set<DispatchType>([
  "tx_block",
  "tx_workflow",
  "orchestrate",
]);

// Map dispatch types to rauto Agent HTTP API endpoints
const HTTP_DISPATCH_ENDPOINT_MAP: Record<DispatchType, string> = {
  exec: "/api/exec",
  template: "/api/template/execute",
  tx_block: "/api/tx/block/async",
  tx_workflow: "/api/tx/workflow/async",
  orchestrate: "/api/orchestrate/async",
};

// Timeout settings: exec is usually faster, other types may take longer
const DISPATCH_TIMEOUT_MAP: Record<DispatchType, number> = {
  exec: 30_000,
  template: 60_000,
  tx_block: 15_000,
  tx_workflow: 15_000,
  orchestrate: 15_000,
};

interface AgentInfo {
  host: string;
  port: number;
  reportMode?: AgentReportMode;
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

export type AgentDispatchExecutionMode = "sync" | "async";

export interface AgentDispatchResult {
  response: Record<string, unknown>;
  statusCode: number;
  executionMode: AgentDispatchExecutionMode;
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
function buildHttpAgentPayload(options: DispatchOptions): Record<string, unknown> {
  const { type, taskId, callbackUrl, connection, payload, dryRun, recordLevel } = options;
  const effectiveRecordLevel = recordLevel ?? getDefaultRecordLevelForType(type);

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
  if (effectiveRecordLevel && effectiveRecordLevel !== "Off") {
    base.record_level =
      RECORD_LEVEL_MAP[effectiveRecordLevel] ?? effectiveRecordLevel;
  }

  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readAgentResponseBody(
  response: Response
): Promise<Record<string, unknown>> {
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : { data: parsed };
  } catch {
    return { raw: text };
  }
}

export function isAsyncDispatchType(type: DispatchType): boolean {
  return ASYNC_DISPATCH_TYPES.has(type);
}

/**
 * Send a dispatch request to the agent.
 * Return the agent response on success or throw on failure.
 */
export async function dispatchToAgent(
  options: DispatchOptions
): Promise<AgentDispatchResult> {
  const { agent, type } = options;

  const timeoutMs = DISPATCH_TIMEOUT_MAP[type];
  const executionMode: AgentDispatchExecutionMode = isAsyncDispatchType(type)
    ? "async"
    : "sync";
  const reportMode = agent.reportMode ?? "http";

  if (reportMode === "grpc") {
    const response = await dispatchTaskOverGrpc({
      ...options,
      timeoutMs,
    });

    return {
      response,
      statusCode: executionMode === "async" ? 202 : 200,
      executionMode,
    };
  }

  const endpoint = HTTP_DISPATCH_ENDPOINT_MAP[type];
  const url = `http://${agent.host}:${agent.port}${endpoint}`;
  const body = buildHttpAgentPayload(options);

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

  if (executionMode === "async" && response.status !== 202) {
    const t = await getSystemTranslator();
    throw new Error(
      `Agent ${t(`tasks.dispatchType.${type}`)} 未按异步协议返回 202 Accepted，实际返回 ${response.status}`
    );
  }

  return {
    response: await readAgentResponseBody(response),
    statusCode: response.status,
    executionMode,
  };
}
