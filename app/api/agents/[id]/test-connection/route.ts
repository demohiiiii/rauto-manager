import { NextRequest, NextResponse } from "next/server";
import {
  isGrpcMethodUnavailable,
  testConnectionOverGrpc,
} from "@/lib/agent-task-grpc";
import { prisma } from "@/lib/prisma";
import { isAgentAvailableStatus } from "@/lib/utils";

const TEST_TIMEOUT_MS = 30000;

/**
 * POST /api/agents/[id]/test-connection
 * Proxy the agent connection test endpoint through Manager
 *
 * rauto endpoint: POST /api/connection/test
 * rauto request body: { connection: { host, port, username, password, enable_password, device_profile, ssh_security } }
 * rauto response: { ok: bool, host, port, username, ssh_security, device_profile }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

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

    if (agent.reportMode === "grpc") {
      try {
        const result = await testConnectionOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: TEST_TIMEOUT_MS,
          connection: {
            host: body.host,
            port: body.port ? Number(body.port) : undefined,
            username: body.username,
            password: body.password,
            enable_password: body.enablePassword || undefined,
            device_profile: body.deviceProfile,
            ssh_security: body.sshSecurity || undefined,
          },
        });

        return NextResponse.json({
          success: result.ok === true,
          data: result,
        });
      } catch (error) {
        if (isGrpcMethodUnavailable(error)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "当前 agent 尚未实现 gRPC TestConnection RPC，暂时无法测试连接",
            },
            { status: 501 }
          );
        }

        throw error;
      }
    }

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/connection/test`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        body: JSON.stringify({
          connection: {
            host: body.host,
            port: body.port ? Number(body.port) : undefined,
            username: body.username,
            password: body.password,
            enable_password: body.enablePassword || undefined,
            device_profile: body.deviceProfile,
            ssh_security: body.sshSecurity || undefined,
          },
        }),
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `连接测试失败: ${response.status} ${text}`,
        },
        { status: 502 }
      );
    }

    // rauto returns { ok: bool, host, port, username, device_profile }
    const result = await response.json();

    return NextResponse.json({
      success: result.ok === true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "连接测试失败",
      },
      { status: 500 }
    );
  }
}
