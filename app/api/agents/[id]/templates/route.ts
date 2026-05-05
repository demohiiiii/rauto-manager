import { NextRequest, NextResponse } from "next/server";
import {
  createAgentTemplate,
  listAgentTemplates,
  parseAgentTemplateKind,
} from "@/lib/agent-template-proxy";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

/**
 * GET /api/agents/[id]/templates
 * Proxy the agent template list through Manager
 *
 * rauto endpoint: GET /api/templates
 * rauto response: [{ name, kind, source, content_type, size_bytes, created_at_ms, updated_at_ms }]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const kind = parseAgentTemplateKind(
      request.nextUrl.searchParams.get("kind") ?? "template",
    );

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
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

    const templates = await listAgentTemplates({ agent, kind });

    return NextResponse.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取模板列表失败",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const kind = parseAgentTemplateKind(
      request.nextUrl.searchParams.get("kind") ?? "template",
    );

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!name || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "模板名称和内容不能为空" },
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

    const template = await createAgentTemplate({
      agent,
      kind,
      name,
      content,
    });

    return NextResponse.json({
      success: true,
      data: { template },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "创建模板失败",
      },
      { status: 500 },
    );
  }
}
