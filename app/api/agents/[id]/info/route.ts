import { NextRequest, NextResponse } from "next/server";
import {
  getAgentInfoOverGrpc,
  isGrpcMethodUnavailable,
} from "@/lib/agent-task-grpc";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

const AGENT_INFO_TIMEOUT_MS = 5000;

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 },
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 },
      );
    }

    if (agent.reportMode === "grpc") {
      try {
        const payload = await getAgentInfoOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: AGENT_INFO_TIMEOUT_MS,
        });

        return NextResponse.json({
          success: true,
          data: {
            name:
              typeof payload.name === "string" && payload.name.trim()
                ? payload.name
                : agent.name,
            version:
              typeof payload.version === "string" && payload.version.trim()
                ? payload.version
                : agent.version,
            capabilities: toStringArray(payload.capabilities),
            uptimeSeconds: toNumber(payload.uptime_seconds),
            connectionsCount: toNumber(payload.connections_count),
            templatesCount: toNumber(payload.templates_count),
            customProfilesCount: toNumber(payload.custom_profiles_count),
            managed: payload.managed === true,
            transport: "grpc",
          },
        });
      } catch (error) {
        if (isGrpcMethodUnavailable(error)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "当前 agent 尚未实现 gRPC GetAgentInfo RPC，暂时无法获取实时 Agent 信息",
            },
            { status: 501 },
          );
        }

        throw error;
      }
    }

    const response = await fetch(`http://${agent.host}:${agent.port}/api/agent/info`, {
      signal: AbortSignal.timeout(AGENT_INFO_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Agent 返回错误: ${response.status} ${text}`,
        },
        { status: 502 },
      );
    }

    const payload = await response.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      data: {
        name:
          typeof payload.name === "string" && payload.name.trim()
            ? payload.name
            : agent.name,
        version:
          typeof payload.version === "string" && payload.version.trim()
            ? payload.version
            : agent.version,
        capabilities: toStringArray(payload.capabilities),
        uptimeSeconds: toNumber(payload.uptime_seconds),
        connectionsCount: toNumber(payload.connections_count),
        templatesCount: toNumber(payload.templates_count),
        customProfilesCount: toNumber(payload.custom_profiles_count),
        managed: payload.managed === true,
        transport: "http",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取 Agent 信息失败",
      },
      { status: 500 },
    );
  }
}
