import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

const CONN_TIMEOUT_MS = 15000;

/**
 * GET /api/agents/[id]/connections
 * Proxy the agent connection list through Manager
 *
 * rauto endpoint: GET /api/connections
 * rauto response: [{ name, host, port, device_profile, has_password }]
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

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 }
      );
    }

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/connections`,
      {
        headers: {
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        signal: AbortSignal.timeout(CONN_TIMEOUT_MS),
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

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: { connections: Array.isArray(data) ? data : data.connections ?? [] },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "获取连接列表失败",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]/connections
 * Proxy connection create/update requests to the agent
 *
 * rauto endpoint: PUT /api/connections/{name}
 * rauto request body: { connection: { host, port, username, password, enable_password, device_profile, ssh_security }, save_password: bool }
 * rauto response: { name, path, has_password, connection: {...} }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "缺少连接名称 (name)" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 }
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线" },
        { status: 400 }
      );
    }

    const agentToken = process.env.AGENT_API_KEY || "";
    const connectionName = encodeURIComponent(body.name);

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/connections/${connectionName}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        body: JSON.stringify({
          connection: {
            connection_name: body.name,
            host: body.host,
            port: body.port ? Number(body.port) : undefined,
            username: body.username,
            password: body.password,
            enable_password: body.enablePassword || undefined,
            device_profile: body.deviceProfile,
            ssh_security: body.sshSecurity || undefined,
          },
          save_password: body.savePassword ?? true,
        }),
        signal: AbortSignal.timeout(CONN_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `保存连接到 Agent 失败: ${response.status} ${text}`,
        },
        { status: 502 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "保存连接失败",
      },
      { status: 500 }
    );
  }
}
