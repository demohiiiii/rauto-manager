import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, AgentHeartbeatInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  // Validate the API key
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: AgentHeartbeatInput = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: name" },
        { status: 400 }
      );
    }

    // Update heartbeat time and runtime metrics by agent name
    await prisma.agent.update({
      where: { name: body.name },
      data: {
        lastHeartbeat: new Date(),
        status: body.status || "online",
        activeSessions: body.active_sessions ?? undefined,
        runningTasksCount: body.running_tasks ?? undefined,
        connectionsCount: body.connections_count ?? undefined,
        templatesCount: body.templates_count ?? undefined,
        uptimeSeconds: body.uptime_seconds ?? undefined,
      },
    });

    const response: ApiResponse<null> = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    // Prisma P2025: Record not found
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: "Agent 未注册，请先调用 /api/agents/register" },
        { status: 404 }
      );
    }

    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "心跳更新失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
