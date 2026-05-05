import { NextRequest, NextResponse } from "next/server";
import {
  getAgentTemplate,
  listAgentTemplates,
  parseAgentTemplateKind,
} from "@/lib/agent-template-proxy";
import { upsertManagerTemplate } from "@/lib/manager-template-store";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const kind = parseAgentTemplateKind(
      typeof body.kind === "string" ? body.kind : "template",
    );
    const selectedNames = Array.isArray(body.names)
      ? body.names.filter((name): name is string => typeof name === "string")
      : [];

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "请选择来源 Agent" },
        { status: 400 },
      );
    }

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
        { status: 400 },
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });

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

    const metas = await listAgentTemplates({ agent, kind });
    const names = selectedNames.length
      ? selectedNames
      : metas.map((template) => template.name);
    const synced = [];

    for (const name of names) {
      const detail = await getAgentTemplate({ agent, kind, name });
      const template = await upsertManagerTemplate({
        kind,
        name: detail.name,
        content: detail.content,
        sourceAgentId: agent.id,
        sourceAgentName: agent.name,
      });
      synced.push(template);
    }

    return NextResponse.json({
      success: true,
      data: { templates: synced, count: synced.length },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "从 Agent 同步模板失败",
      },
      { status: 500 },
    );
  }
}
