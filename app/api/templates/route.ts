import { NextRequest, NextResponse } from "next/server";
import { parseAgentTemplateKind } from "@/lib/agent-template-proxy";
import {
  listManagerTemplates,
  upsertManagerTemplate,
} from "@/lib/manager-template-store";

export async function GET(request: NextRequest) {
  try {
    const rawKind = request.nextUrl.searchParams.get("kind");
    const kind = rawKind ? parseAgentTemplateKind(rawKind) : null;

    if (rawKind && !kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
        { status: 400 },
      );
    }

    const templates = await listManagerTemplates(kind ?? undefined);

    return NextResponse.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取 Manager 模板库失败",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = parseAgentTemplateKind(
      typeof body.kind === "string" ? body.kind : "template",
    );
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "模板类型无效" },
        { status: 400 },
      );
    }

    if (!name || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "模板名称和内容不能为空" },
        { status: 400 },
      );
    }

    const template = await upsertManagerTemplate({
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
        error: error instanceof Error ? error.message : "保存 Manager 模板失败",
      },
      { status: 500 },
    );
  }
}
