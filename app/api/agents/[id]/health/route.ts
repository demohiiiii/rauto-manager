import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HEALTH_CHECK_TIMEOUT_MS = 5000;

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

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(`http://${agent.host}:${agent.port}/health`, {
      headers: {
        ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
      },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

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
