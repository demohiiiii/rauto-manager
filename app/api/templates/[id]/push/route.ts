import { NextRequest, NextResponse } from "next/server";
import { createAgentTemplate } from "@/lib/agent-template-proxy";
import { getManagerTemplateById } from "@/lib/manager-template-store";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const agentId = typeof body.agentId === "string" ? body.agentId : "";

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "请选择目标 Agent" },
        { status: 400 },
      );
    }

    const [template, agent] = await Promise.all([
      getManagerTemplateById(id),
      prisma.agent.findUnique({ where: { id: agentId } }),
    ]);

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Manager 模板不存在" },
        { status: 404 },
      );
    }

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

    const pushed = await createAgentTemplate({
      agent,
      kind: template.kind,
      name: template.name,
      content: template.content,
    });

    return NextResponse.json({
      success: true,
      data: { template: pushed },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "下发模板失败",
      },
      { status: 500 },
    );
  }
}
