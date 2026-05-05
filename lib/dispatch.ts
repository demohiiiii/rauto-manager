import { dispatchTaskOverGrpc } from "@/lib/agent-task-grpc";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import {
  getDefaultRecordLevelForType,
  normalizeRecordLevel,
} from "@/lib/record-level";
import { buildTxBlockJsonFromPayload } from "@/lib/tx-block-serialize";
import type {
  AgentReportMode,
  ConnectionPayload,
  DispatchType,
  RecordLevel,
} from "@/lib/types";

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const ASYNC_DISPATCH_TYPES = new Set<DispatchType>([
  "exec",
  "template",
  "tx_block",
  "tx_workflow",
  "orchestrate",
]);
const GRPC_ASYNC_DISPATCH_TYPES = new Set<DispatchType>([
  "tx_block",
  "tx_workflow",
  "orchestrate",
]);

// Map dispatch types to rauto Agent HTTP API endpoints
const HTTP_DISPATCH_ENDPOINT_MAP: Record<DispatchType, string> = {
  exec: "/api/exec/async",
  template: "/api/template/execute/async",
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

interface AgentDispatchOptions {
  agent: AgentInfo;
  type: DispatchType;
  taskId: string;
  connection?: ConnectionPayload;
  payload: Record<string, unknown>;
  dryRun?: boolean;
  recordLevel?: RecordLevel;
}

export type AgentDispatchExecutionMode = "sync" | "async";

export interface AgentDispatchResult {
  response: Record<string, unknown>;
  statusCode: number;
  executionMode: AgentDispatchExecutionMode;
}

// RecordLevel uses PascalCase in Manager and kebab-case in rauto Agent
const RECORD_LEVEL_MAP: Record<RecordLevel, string> = {
  KeyEventsOnly: "key-events-only",
  Full: "full",
};

/**
 * Build the full request payload sent to the agent.
 * Convert the Manager dispatch request into the format accepted by rauto Agent.
 */
function buildHttpAgentPayload(
  options: AgentDispatchOptions,
): Record<string, unknown> {
  const { type, taskId, connection, payload, dryRun, recordLevel } = options;
  const effectiveRecordLevel =
    normalizeRecordLevel(recordLevel) ?? getDefaultRecordLevelForType(type);

  const base: Record<string, unknown> = {
    task_id: taskId,
  };

  // Inject connection details for dispatch types that support the connection field
  if (connection && type !== "orchestrate") {
    base.connection = connection;
  }

  // Inject dry_run for dispatch types that support it
  if (dryRun !== undefined && type !== "exec") {
    base.dry_run = dryRun;
  }

  base.record_level = RECORD_LEVEL_MAP[effectiveRecordLevel];

  switch (type) {
    case "tx_block": {
      const txBlockJson = buildTxBlockJsonFromPayload(payload);
      const hasCommands =
        Array.isArray(payload.commands) && payload.commands.length > 0;
      const hasStructuredTxBlock =
        payload.tx_block &&
        typeof payload.tx_block === "object" &&
        !Array.isArray(payload.tx_block);
      const request: Record<string, unknown> = {
        ...base,
        tx_block: JSON.parse(txBlockJson) as unknown,
      };

      if (
        !hasCommands &&
        !hasStructuredTxBlock &&
        typeof payload.template === "string" &&
        payload.template.trim()
      ) {
        request.tx_block_template_name = payload.template.trim();
      }

      if (isRecord(payload.vars)) {
        request.tx_block_template_vars = payload.vars;
      } else {
        request.tx_block_template_vars = {};
      }

      return request;
    }
    case "tx_workflow":
      return {
        ...base,
        workflow: payload.workflow ?? null,
      };
    case "orchestrate":
      return {
        ...base,
        plan: payload.plan ?? null,
        ...(typeof payload.base_dir === "string" && payload.base_dir.trim()
          ? { base_dir: payload.base_dir.trim() }
          : {}),
      };
    default:
      return {
        ...base,
        ...payload,
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readAgentResponseBody(
  response: Response,
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
  options: AgentDispatchOptions,
): Promise<AgentDispatchResult> {
  const { agent, type } = options;

  const timeoutMs = DISPATCH_TIMEOUT_MAP[type];
  const executionMode: AgentDispatchExecutionMode = "async";
  const reportMode = agent.reportMode ?? "http";

  if (reportMode === "grpc" && GRPC_ASYNC_DISPATCH_TYPES.has(type)) {
    const response = await dispatchTaskOverGrpc({
      ...options,
      timeoutMs,
    });

    return {
      response,
      statusCode: 202,
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
      `Agent ${t(`tasks.dispatchType.${type}`)} 失败: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
    );
  }

  if (response.status !== 202) {
    const t = await getSystemTranslator();
    throw new Error(
      `Agent ${t(`tasks.dispatchType.${type}`)} 未按异步协议返回 202 Accepted，实际返回 ${response.status}`,
    );
  }

  return {
    response: await readAgentResponseBody(response),
    statusCode: response.status,
    executionMode,
  };
}
