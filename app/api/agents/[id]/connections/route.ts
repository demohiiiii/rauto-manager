import { NextRequest, NextResponse } from "next/server";
import {
  isGrpcMethodUnavailable,
  listConnectionsOverGrpc,
  listProfileModesOverGrpc,
  upsertConnectionOverGrpc,
} from "@/lib/agent-task-grpc";
import { normalizeDeviceProfileModes } from "@/lib/profile-mode";
import { prisma } from "@/lib/prisma";
import type { AgentConnection, DeviceProfileModes } from "@/lib/types";
import {
  buildConnectionPayloadFromInput,
  isAgentAvailableStatus,
} from "@/lib/utils";

const CONN_TIMEOUT_MS = 15000;

function normalizeListedConnection(input: unknown): AgentConnection | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const name =
    typeof raw.name === "string"
      ? raw.name.trim()
      : typeof raw.connection_name === "string"
        ? raw.connection_name.trim()
        : "";

  if (!name) {
    return null;
  }

  const normalized = buildConnectionPayloadFromInput(raw, {
    fallbackConnectionName: name,
  });

  return {
    name,
    host: normalized?.host,
    port: normalized?.port,
    username: normalized?.username,
    ssh_security: normalized?.ssh_security,
    device_profile: normalized?.device_profile?.trim(),
    linux_shell_flavor: normalized?.linux_shell_flavor,
    template_dir: normalized?.template_dir,
    enable_password_empty_enter: normalized?.enable_password_empty_enter,
    enabled: normalized?.enabled,
    labels: normalized?.labels,
    groups: normalized?.groups,
    vars: normalized?.vars,
    has_password:
      typeof raw.has_password === "boolean" ? raw.has_password : undefined,
  };
}

async function enrichConnectionsWithProfileModes(
  reportMode: "http" | "grpc",
  host: string,
  port: number,
  connections: AgentConnection[],
  agentToken: string,
): Promise<AgentConnection[]> {
  const uniqueProfiles = Array.from(
    new Set(
      connections
        .map((connection) => connection.device_profile?.trim())
        .filter((profile): profile is string => Boolean(profile)),
    ),
  );

  if (uniqueProfiles.length === 0) {
    return connections;
  }

  const profileModesByName = new Map<
    string,
    { default_mode: string; modes: string[] }
  >();

  await Promise.all(
    uniqueProfiles.map(async (profile) => {
      try {
        const normalized =
          reportMode === "grpc"
            ? normalizeDeviceProfileModes(
                (await listProfileModesOverGrpc({
                  agent: { host, port, reportMode: "grpc" },
                  timeoutMs: CONN_TIMEOUT_MS,
                  name: profile,
                })) as unknown as DeviceProfileModes,
              )
            : await (async () => {
                const response = await fetch(
                  `http://${host}:${port}/api/device-profiles/${encodeURIComponent(
                    profile,
                  )}/modes`,
                  {
                    headers: {
                      ...(agentToken && {
                        Authorization: `Bearer ${agentToken}`,
                      }),
                    },
                    signal: AbortSignal.timeout(CONN_TIMEOUT_MS),
                  },
                );

                if (!response.ok) {
                  return null;
                }

                const text = await response.text().catch(() => "");
                if (!text.trim()) {
                  return null;
                }

                return normalizeDeviceProfileModes(JSON.parse(text));
              })();

        if (!normalized) {
          return;
        }

        profileModesByName.set(profile, {
          default_mode: normalized.default_mode,
          modes: normalized.modes,
        });
      } catch {
        // Ignore per-profile failures so a single bad profile does not break the list.
      }
    }),
  );

  return connections.map((connection) => {
    const profile = connection.device_profile?.trim();
    const summary = profile ? profileModesByName.get(profile) : undefined;

    if (!summary) {
      return profile ? { ...connection, device_profile: profile } : connection;
    }

    return {
      ...connection,
      device_profile: profile,
      default_mode: summary.default_mode,
      available_modes: summary.modes,
    };
  });
}

/**
 * GET /api/agents/[id]/connections
 * Proxy the agent connection list through Manager
 *
 * rauto endpoint: GET /api/connections
 * rauto response: [{ name, host, port, device_profile, has_password }]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

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

    if (agent.reportMode === "grpc") {
      try {
        const result = await listConnectionsOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: CONN_TIMEOUT_MS,
        });

        const connections = Array.isArray(result.connections)
          ? result.connections
              .map((connection) => normalizeListedConnection(connection))
              .filter((connection): connection is AgentConnection =>
                Boolean(connection),
              )
          : [];
        const enrichedConnections = await enrichConnectionsWithProfileModes(
          "grpc",
          agent.host,
          agent.port,
          connections,
          "",
        );

        return NextResponse.json({
          success: true,
          data: {
            connections: enrichedConnections,
          },
        });
      } catch (error) {
        if (isGrpcMethodUnavailable(error)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "当前 agent 尚未实现 gRPC ListConnections RPC，暂时无法获取已保存连接列表",
            },
            { status: 501 },
          );
        }

        throw error;
      }
    }

    const agentToken = process.env.AGENT_API_KEY || "";

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/connections`,
      {
        headers: {
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        signal: AbortSignal.timeout(CONN_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Agent 返回错误: ${response.status} ${text}`,
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    const rawConnections = Array.isArray(data)
      ? data
      : (data.connections ?? []);
    const connections = Array.isArray(rawConnections)
      ? rawConnections
          .map((connection) => normalizeListedConnection(connection))
          .filter((connection): connection is AgentConnection =>
            Boolean(connection),
          )
      : [];
    const enrichedConnections = await enrichConnectionsWithProfileModes(
      "http",
      agent.host,
      agent.port,
      connections,
      agentToken,
    );

    return NextResponse.json({
      success: true,
      data: { connections: enrichedConnections },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取连接列表失败",
      },
      { status: 500 },
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const connectionNameValue = typeof body.name === "string" ? body.name : "";
    const savePassword =
      typeof body.savePassword === "boolean" ? body.savePassword : true;
    const connection = buildConnectionPayloadFromInput(body, {
      fallbackConnectionName: connectionNameValue || undefined,
    });

    if (!connectionNameValue) {
      return NextResponse.json(
        { success: false, error: "缺少连接名称 (name)" },
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

    if (agent.reportMode === "grpc") {
      try {
        const result = await upsertConnectionOverGrpc({
          agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
          timeoutMs: CONN_TIMEOUT_MS,
          name: connectionNameValue,
          connection: connection ?? {},
          savePassword,
        });

        return NextResponse.json({
          success: true,
          data: result,
        });
      } catch (error) {
        if (isGrpcMethodUnavailable(error)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "当前 agent 尚未实现 gRPC UpsertConnection RPC，暂时无法保存连接",
            },
            { status: 501 },
          );
        }

        throw error;
      }
    }

    const agentToken = process.env.AGENT_API_KEY || "";
    const connectionName = encodeURIComponent(connectionNameValue);

    const response = await fetch(
      `http://${agent.host}:${agent.port}/api/connections/${connectionName}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(agentToken && { Authorization: `Bearer ${agentToken}` }),
        },
        body: JSON.stringify({
          connection: connection ?? {},
          save_password: savePassword,
        }),
        signal: AbortSignal.timeout(CONN_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `保存连接到 Agent 失败: ${response.status} ${text}`,
        },
        { status: 502 },
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
        error: error instanceof Error ? error.message : "保存连接失败",
      },
      { status: 500 },
    );
  }
}
