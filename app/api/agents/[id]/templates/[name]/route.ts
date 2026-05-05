import { NextRequest, NextResponse } from "next/server";
import {
  getAgentTemplate,
  parseAgentTemplateKind,
} from "@/lib/agent-template-proxy";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  try {
    const { id, name } = await params;
    const kind = parseAgentTemplateKind(
      request.nextUrl.searchParams.get("kind") ?? "template",
    );

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
        { status: 400 },
      );
    }

    const templateName = decodeURIComponent(name).trim();
    if (!templateName) {
      return NextResponse.json(
        { success: false, error: "模板名称不能为空" },
        { status: 400 },
      );
    }

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

    const template = await getAgentTemplate({
      agent,
      kind,
      name: templateName,
    });

    return NextResponse.json({
      success: true,
      data: { template },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取模板详情失败",
      },
      { status: 500 },
    );
  }
}
