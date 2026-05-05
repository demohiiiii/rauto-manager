import {
  createAgentTemplateOverGrpc,
  getAgentTemplateOverGrpc,
  isGrpcMethodUnavailable,
  listAgentTemplatesOverGrpc,
  type AgentTemplateKind,
} from "@/lib/agent-task-grpc";

export type { AgentTemplateKind };

export interface AgentTemplateMeta {
  name: string;
  kind: string;
  source: string;
  contentType: string;
  sizeBytes: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AgentTemplateDetail extends AgentTemplateMeta {
  content: string;
}

interface AgentTemplateProxyAgent {
  host: string;
  port: number;
  reportMode: string;
}

const AGENT_TIMEOUT_MS = 10000;
const TEMPLATE_KINDS: AgentTemplateKind[] = [
  "template",
  "tx_block",
  "tx_workflow",
  "orchestrate",
];

const HTTP_TEMPLATE_PATHS: Record<AgentTemplateKind, string> = {
  template: "/api/templates",
  tx_block: "/api/tx-block-templates",
  tx_workflow: "/api/tx-workflow-templates",
  orchestrate: "/api/orchestration-templates",
};

const TEMPLATE_GRPC_METHOD_NAMES: Record<
  AgentTemplateKind,
  { list: string; get: string; create: string }
> = {
  template: {
    list: "ListTemplates",
    get: "GetTemplate",
    create: "CreateTemplate",
  },
  tx_block: {
    list: "ListTxBlockTemplates",
    get: "GetTxBlockTemplate",
    create: "CreateTxBlockTemplate",
  },
  tx_workflow: {
    list: "ListTxWorkflowTemplates",
    get: "GetTxWorkflowTemplate",
    create: "CreateTxWorkflowTemplate",
  },
  orchestrate: {
    list: "ListOrchestrationTemplates",
    get: "GetOrchestrationTemplate",
    create: "CreateOrchestrationTemplate",
  },
};

export function parseAgentTemplateKind(
  value: string | null | undefined,
): AgentTemplateKind | null {
  return TEMPLATE_KINDS.includes(value as AgentTemplateKind)
    ? (value as AgentTemplateKind)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTemplateMeta(value: unknown): AgentTemplateMeta | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  return {
    name: value.name,
    kind: typeof value.kind === "string" ? value.kind : "",
    source: typeof value.source === "string" ? value.source : "",
    contentType:
      typeof value.content_type === "string" ? value.content_type : "",
    sizeBytes: typeof value.size_bytes === "number" ? value.size_bytes : 0,
    createdAtMs:
      typeof value.created_at_ms === "number" ? value.created_at_ms : 0,
    updatedAtMs:
      typeof value.updated_at_ms === "number" ? value.updated_at_ms : 0,
  };
}

function normalizeTemplateDetail(value: unknown): AgentTemplateDetail | null {
  const meta = normalizeTemplateMeta(value);
  if (!meta || !isRecord(value)) {
    return null;
  }

  return {
    ...meta,
    content: typeof value.content === "string" ? value.content : "",
  };
}

function normalizeTemplateList(value: unknown): AgentTemplateMeta[] {
  const rawTemplates = isRecord(value) ? value.templates : value;
  return Array.isArray(rawTemplates)
    ? rawTemplates
        .map(normalizeTemplateMeta)
        .filter((item): item is AgentTemplateMeta => item !== null)
    : [];
}

function getAgentTokenHeaders(): HeadersInit {
  const agentToken = process.env.AGENT_API_KEY || "";
  return {
    ...(agentToken ? { Authorization: `Bearer ${agentToken}` } : {}),
  };
}

async function parseAgentHttpResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Agent 返回错误: ${response.status} ${text}`);
  }

  return response.json();
}

function buildAgentUrl(
  agent: AgentTemplateProxyAgent,
  kind: AgentTemplateKind,
  name?: string,
): string {
  const basePath = HTTP_TEMPLATE_PATHS[kind];
  const suffix = name ? `/${encodeURIComponent(name)}` : "";
  return `http://${agent.host}:${agent.port}${basePath}${suffix}`;
}

function getGrpcUnavailableMessage(
  kind: AgentTemplateKind,
  method: string,
): string {
  return `当前 agent 尚未实现 gRPC ${method} RPC，暂时无法管理 ${kind} 模板`;
}

export async function listAgentTemplates(options: {
  agent: AgentTemplateProxyAgent;
  kind: AgentTemplateKind;
}): Promise<AgentTemplateMeta[]> {
  if (options.agent.reportMode === "grpc") {
    try {
      const result = await listAgentTemplatesOverGrpc({
        agent: {
          host: options.agent.host,
          port: options.agent.port,
          reportMode: "grpc",
        },
        timeoutMs: AGENT_TIMEOUT_MS,
        kind: options.kind,
      });
      return normalizeTemplateList(result);
    } catch (error) {
      if (isGrpcMethodUnavailable(error)) {
        throw new Error(
          getGrpcUnavailableMessage(
            options.kind,
            TEMPLATE_GRPC_METHOD_NAMES[options.kind].list,
          ),
        );
      }
      throw error;
    }
  }

  const response = await fetch(buildAgentUrl(options.agent, options.kind), {
    headers: getAgentTokenHeaders(),
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  });

  return normalizeTemplateList(await parseAgentHttpResponse(response));
}

export async function getAgentTemplate(options: {
  agent: AgentTemplateProxyAgent;
  kind: AgentTemplateKind;
  name: string;
}): Promise<AgentTemplateDetail> {
  if (options.agent.reportMode === "grpc") {
    try {
      const result = await getAgentTemplateOverGrpc({
        agent: {
          host: options.agent.host,
          port: options.agent.port,
          reportMode: "grpc",
        },
        timeoutMs: AGENT_TIMEOUT_MS,
        kind: options.kind,
        name: options.name,
      });
      const detail = normalizeTemplateDetail(result);
      if (!detail) {
        throw new Error("Agent 返回的模板详情无效");
      }
      return detail;
    } catch (error) {
      if (isGrpcMethodUnavailable(error)) {
        throw new Error(
          getGrpcUnavailableMessage(
            options.kind,
            TEMPLATE_GRPC_METHOD_NAMES[options.kind].get,
          ),
        );
      }
      throw error;
    }
  }

  const response = await fetch(
    buildAgentUrl(options.agent, options.kind, options.name),
    {
      headers: getAgentTokenHeaders(),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    },
  );
  const detail = normalizeTemplateDetail(
    await parseAgentHttpResponse(response),
  );
  if (!detail) {
    throw new Error("Agent 返回的模板详情无效");
  }
  return detail;
}

export async function createAgentTemplate(options: {
  agent: AgentTemplateProxyAgent;
  kind: AgentTemplateKind;
  name: string;
  content: string;
}): Promise<AgentTemplateDetail> {
  if (options.agent.reportMode === "grpc") {
    try {
      const result = await createAgentTemplateOverGrpc({
        agent: {
          host: options.agent.host,
          port: options.agent.port,
          reportMode: "grpc",
        },
        timeoutMs: AGENT_TIMEOUT_MS,
        kind: options.kind,
        name: options.name,
        content: options.content,
      });
      const detail = normalizeTemplateDetail(result);
      if (!detail) {
        throw new Error("Agent 返回的模板详情无效");
      }
      return detail;
    } catch (error) {
      if (isGrpcMethodUnavailable(error)) {
        throw new Error(
          getGrpcUnavailableMessage(
            options.kind,
            TEMPLATE_GRPC_METHOD_NAMES[options.kind].create,
          ),
        );
      }
      throw error;
    }
  }

  const response = await fetch(buildAgentUrl(options.agent, options.kind), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAgentTokenHeaders(),
    },
    body: JSON.stringify({ name: options.name, content: options.content }),
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  });
  const detail = normalizeTemplateDetail(
    await parseAgentHttpResponse(response),
  );
  if (!detail) {
    throw new Error("Agent 返回的模板详情无效");
  }
  return detail;
}
