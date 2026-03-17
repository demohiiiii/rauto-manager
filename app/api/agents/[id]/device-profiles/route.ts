import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AGENT_TIMEOUT_MS = 10000;

/**
 * GET /api/agents/[id]/device-profiles
 * 代理获取 Agent 的 device profiles（builtin + custom）
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

    if (agent.status !== "online") {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 }
      );
    }

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/device-profiles/all`,
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

    // rauto 返回 { builtins: [{ name, aliases, summary }], custom: [{ name, path }] }
    const data = await response.json();

    // 提取所有 profile 名称（builtin names + custom names）
    const builtinNames: string[] = (data.builtins ?? []).map(
      (p: { name: string }) => p.name
    );
    const customNames: string[] = (data.custom ?? []).map(
      (p: { name: string }) => p.name
    );

    return NextResponse.json({
      success: true,
      data: {
        builtins: data.builtins ?? [],
        custom: data.custom ?? [],
        all: [...builtinNames, ...customNames],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "获取 Device Profiles 失败",
      },
      { status: 500 }
    );
  }
}
