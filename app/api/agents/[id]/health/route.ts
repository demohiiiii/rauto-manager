import { NextRequest, NextResponse } from "next/server";
import { getAgentStatusOverGrpc } from "@/lib/agent-task-grpc";
import { prisma } from "@/lib/prisma";

const HEALTH_CHECK_TIMEOUT_MS = 5000;

function formatHealthCheckError(
  error: unknown,
  transport: "http" | "grpc"
): string {
  const detail =
    error instanceof Error ? error.message : "Unknown health check error";
  const transportLabel = transport === "grpc" ? "gRPC" : "HTTP";

  if (/ECONNREFUSED|No connection established|fetch failed|ENOTFOUND|ETIMEDOUT/i.test(detail)) {
    return `无法连接到 Agent（${transportLabel}）。错误详情：${detail}`;
  }

  return `${transportLabel} 健康检查失败：${detail}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 }
      );
    }

    if (agent.reportMode === "grpc") {
      try {
        const payload = await getAgentStatusOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
        });

        return NextResponse.json({
          success: true,
          data: {
            healthy: true,
            transport: "grpc",
            agentStatus:
              typeof payload.status === "string" ? payload.status : agent.status,
            payload,
          },
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: formatHealthCheckError(error, "grpc"),
          },
          { status: 502 }
        );
      }
    }

    const agentToken = process.env.AGENT_API_KEY || "";
    let response: Response;

    try {
      response = await fetch(`http://${agent.host}:${agent.port}/health`, {
        headers: {
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: formatHealthCheckError(error, "http"),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Health check failed: ${response.status} ${text}`,
        },
        { status: 502 }
      );
    }

    const payload = await response.json().catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        healthy: true,
        transport: "http",
        agentStatus: agent.status,
        payload,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 }
    );
  }
}
