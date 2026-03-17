import type { DispatchType } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

const AGENT_API_KEY = process.env.AGENT_API_KEY;

// dispatch type → rauto Agent API 路径映射
const DISPATCH_ENDPOINT_MAP: Record<DispatchType, string> = {
  exec: "/api/exec",
  template: "/api/template/execute",
  tx_block: "/api/tx/block",
  tx_workflow: "/api/tx/workflow",
  orchestrate: "/api/orchestrate",
};

// 超时配置：exec 较快，其他可能耗时较长
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

// RecordLevel: Manager 使用 PascalCase，rauto Agent 使用 kebab-case
const RECORD_LEVEL_MAP: Record<string, string> = {
  Off: "off",
  KeyEventsOnly: "key-events-only",
  Full: "full",
};

/**
 * 构建发送给 Agent 的完整请求体
 * 将 Manager 的 dispatch 请求转换为 rauto Agent 接受的格式
 */
function buildAgentPayload(options: DispatchOptions): Record<string, unknown> {
  const { type, taskId, callbackUrl, connection, payload, dryRun, recordLevel } = options;

  const base: Record<string, unknown> = {
    ...payload,
    task_id: taskId,
    callback_url: callbackUrl,
  };

  // 注入连接信息（exec/template/tx_block/tx_workflow 支持 connection 字段）
  if (connection && type !== "orchestrate") {
    base.connection = connection;
  }

  // 注入 dry_run（template/tx_block/tx_workflow/orchestrate 支持）
  if (dryRun !== undefined && type !== "exec") {
    base.dry_run = dryRun;
  }

  // 注入 record_level（转换为 kebab-case 格式）
  if (recordLevel) {
    base.record_level = RECORD_LEVEL_MAP[recordLevel] ?? recordLevel;
  }

  return base;
}

/**
 * 向 Agent 发送下发请求
 * 返回 Agent 的响应（成功时），或抛出错误（失败时）
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
