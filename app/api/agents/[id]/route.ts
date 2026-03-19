import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import {
  AgentManagementError,
  deleteOfflineAgentById,
} from "@/lib/agent-management";
import { serializeAgent } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 },
      );
    }

    const response: ApiResponse<ReturnType<typeof serializeAgent>> = {
      success: true,
      data: serializeAgent(agent),
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取 Agent 失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingAgent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 },
      );
    }

    const updatedAgent = await prisma.agent.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.host === "string" ? { host: body.host } : {}),
        ...(typeof body.port === "number" ? { port: body.port } : {}),
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        ...(Array.isArray(body.capabilities)
          ? {
              capabilities: body.capabilities.filter(
                (capability: unknown): capability is string =>
                  typeof capability === "string",
              ),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "version")
          ? { version: typeof body.version === "string" ? body.version : null }
          : {}),
      },
    });

    const response: ApiResponse<ReturnType<typeof serializeAgent>> = {
      success: true,
      data: serializeAgent(updatedAgent),
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "更新 Agent 失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deletedAgent = await deleteOfflineAgentById(id);

    return NextResponse.json({
      success: true,
      data: deletedAgent,
    });
  } catch (error) {
    if (error instanceof AgentManagementError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "删除 Agent 失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
