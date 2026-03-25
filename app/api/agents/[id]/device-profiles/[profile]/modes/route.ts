import { NextRequest, NextResponse } from "next/server";
import {
  isGrpcMethodUnavailable,
  listProfileModesOverGrpc,
} from "@/lib/agent-task-grpc";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

const AGENT_TIMEOUT_MS = 10000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; profile: string }> }
) {
  try {
    const { id, profile } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 }
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 }
      );
    }

    if (agent.reportMode === "grpc") {
      try {
        const result = await listProfileModesOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: AGENT_TIMEOUT_MS,
          name: profile.trim(),
        });

        return NextResponse.json({
          success: true,
          data: result,
        });
      } catch (error) {
        if (isGrpcMethodUnavailable(error)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "当前 agent 尚未实现 gRPC ListProfileModes RPC，暂时无法获取 Device Profile 模式列表",
            },
            { status: 501 }
          );
        }

        throw error;
      }
    }

    const agentToken = process.env.AGENT_API_KEY || "";
    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/device-profiles/${encodeURIComponent(
        profile.trim()
      )}/modes`,
      {
        headers: {
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      }
    );

    const text = await response.text().catch(() => "");
    const parsed = text.trim()
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : null;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            typeof parsed?.error === "string"
              ? parsed.error
              : text || `Agent 返回错误: ${response.status}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "获取 Device Profile 模式失败",
      },
      { status: 500 }
    );
  }
}
