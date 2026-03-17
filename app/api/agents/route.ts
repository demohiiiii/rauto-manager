import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { markTimedOutAgents } from "@/lib/agent-timeout";
import { serializeAgent } from "@/lib/utils";

export async function GET() {
  try {
    // Lazily detect timed-out agents and mark stale online agents as offline
    await markTimedOutAgents();

    const agents = await prisma.agent.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const serializable = agents.map(serializeAgent);

    const response: ApiResponse<typeof serializable> = {
      success: true,
      data: serializable,
      meta: {
        total: agents.length,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取 Agent 列表失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newAgent = await prisma.agent.create({
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        status: "offline",
        capabilities: body.capabilities || [],
        version: body.version,
      },
    });

    const response: ApiResponse<ReturnType<typeof serializeAgent>> = {
      success: true,
      data: serializeAgent(newAgent),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "创建 Agent 失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少 Agent ID" },
        { status: 400 },
      );
    }

    await prisma.agent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "删除 Agent 失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
