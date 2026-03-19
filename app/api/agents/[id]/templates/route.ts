import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

const AGENT_TIMEOUT_MS = 10000;

/**
 * GET /api/agents/[id]/templates
 * Proxy the agent template list through Manager
 *
 * rauto endpoint: GET /api/templates
 * rauto response: [{ name, path }]
 */
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

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 }
      );
    }

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/templates`,
      {
        headers: {
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Agent 返回错误: ${response.status} ${text}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: { templates: Array.isArray(data) ? data : data.templates ?? [] },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "获取模板列表失败",
      },
      { status: 500 }
    );
  }
}
