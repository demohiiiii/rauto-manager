import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import {
  isGrpcMethodUnavailable,
  listConnectionsOverGrpc,
  probeDevicesOverGrpc,
} from "@/lib/agent-task-grpc";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isAgentAvailableStatus } from "@/lib/utils";

const SYNC_TIMEOUT_MS = 30000; // 30-second timeout

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    // Look up the agent
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 }
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        { success: false, error: "Agent 当前不在线，无法同步设备" },
        { status: 400 }
      );
    }

    if (agent.reportMode === "grpc") {
      let connections = Array.isArray(body.connections)
        ? body.connections.filter(
            (item: unknown): item is string =>
              typeof item === "string" && item.trim().length > 0
          )
        : [];

      if (connections.length === 0) {
        try {
          const listResult = await listConnectionsOverGrpc({
            agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
            timeoutMs: SYNC_TIMEOUT_MS,
          });

          connections = Array.isArray(listResult.connections)
            ? listResult.connections
                .map((item) =>
                  typeof item === "object" &&
                  item !== null &&
                  typeof item.name === "string"
                    ? item.name
                    : null
                )
                .filter((item): item is string => Boolean(item && item.trim()))
            : [];
        } catch (error) {
          if (isGrpcMethodUnavailable(error)) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "当前 agent 尚未实现 gRPC ListConnections RPC，grpc 模式下暂时无法自动发现库存连接",
              },
              { status: 501 }
            );
          }

          throw error;
        }
      }

      if (connections.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "当前 agent 没有返回任何可探测的已保存连接",
          },
          { status: 400 }
        );
      }

      const probeData = await probeDevicesOverGrpc({
        agent: { host: agent.host, port: agent.port, reportMode: "grpc" },
        connections,
        timeoutMs: SYNC_TIMEOUT_MS,
      });

      const remoteDevices: Array<{
        name: string;
        type: string;
        host: string;
        port?: number;
        status?: string;
        metadata?: Prisma.InputJsonValue;
      }> = Array.isArray(probeData.results)
        ? probeData.results
            .filter(
              (
                device
              ): device is {
                name?: unknown;
                host?: unknown;
                port?: unknown;
                device_profile?: unknown;
                reachable?: unknown;
              } => typeof device === "object" && device !== null
            )
            .map((device) => ({
              name: typeof device.name === "string" ? device.name : "unknown",
              type:
                typeof device.device_profile === "string"
                  ? device.device_profile
                  : "unknown",
              host: typeof device.host === "string" ? device.host : "",
              port:
                typeof device.port === "number" && Number.isInteger(device.port)
                  ? device.port
                  : undefined,
              status: device.reachable === true ? "reachable" : "unreachable",
            }))
            .filter((device) => device.host.trim().length > 0)
        : [];

      const syncedDevices = await prisma.$transaction(async (tx) => {
        const existingDevices = await tx.device.findMany({
          where: { agentId: id },
        });

        const remoteKeys = new Set(
          remoteDevices.map((d) => `${d.name}:${d.host}`)
        );

        const toDelete = existingDevices.filter(
          (d) => !remoteKeys.has(`${d.name}:${d.host}`)
        );
        if (toDelete.length > 0) {
          await tx.device.deleteMany({
            where: { id: { in: toDelete.map((d) => d.id) } },
          });
        }

        const results = [];
        for (const device of remoteDevices) {
          const existing = existingDevices.find(
            (d) => d.name === device.name && d.host === device.host
          );

          if (existing) {
            results.push(
              await tx.device.update({
                where: { id: existing.id },
                data: {
                  type: device.type,
                  port: device.port,
                  status: device.status ?? "unknown",
                  lastChecked: new Date(),
                  metadata: device.metadata ?? undefined,
                },
              })
            );
            continue;
          }

          results.push(
            await tx.device.create({
              data: {
                agentId: id,
                name: device.name,
                type: device.type,
                host: device.host,
                port: device.port,
                status: device.status ?? "unknown",
                lastChecked: new Date(),
                metadata: device.metadata,
              },
            })
          );
        }

        return results;
      });

      const response: ApiResponse<typeof syncedDevices> = {
        success: true,
        data: syncedDevices,
        meta: { total: syncedDevices.length },
      };

      return NextResponse.json(response);
    }

    // Call the agent device probe endpoint
    const probeResponse = await fetch(
      `http://${agent.host}:${agent.port}/api/devices/probe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.AGENT_API_KEY && {
            "X-API-Key": process.env.AGENT_API_KEY,
          }),
        },
        signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      }
    );

    if (!probeResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent 设备探测失败: ${probeResponse.status}`,
        },
        { status: 502 }
      );
    }

    const probeData = await probeResponse.json();
    const remoteDevices: Array<{
      name: string;
      type: string;
      host: string;
      port?: number;
      status?: string;
      metadata?: Prisma.InputJsonValue;
    }> = probeData.data ?? probeData.devices ?? [];

    // Fully sync devices inside a transaction
    const syncedDevices = await prisma.$transaction(async (tx) => {
      // Load all devices currently stored for this agent
      const existingDevices = await tx.device.findMany({
        where: { agentId: id },
      });

      // Build a set of unique identifiers for remote devices
      const remoteKeys = new Set(
        remoteDevices.map((d) => `${d.name}:${d.host}`)
      );

      // Delete devices that no longer exist remotely
      const toDelete = existingDevices.filter(
        (d) => !remoteKeys.has(`${d.name}:${d.host}`)
      );
      if (toDelete.length > 0) {
        await tx.device.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        });
      }

      // Upsert remote devices
      const results = [];
      for (const device of remoteDevices) {
        const existing = existingDevices.find(
          (d) => d.name === device.name && d.host === device.host
        );

        if (existing) {
          const updated = await tx.device.update({
            where: { id: existing.id },
            data: {
              type: device.type,
              port: device.port,
              status: device.status ?? "unknown",
              lastChecked: new Date(),
              metadata: device.metadata ?? undefined,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.device.create({
            data: {
              agentId: id,
              name: device.name,
              type: device.type,
              host: device.host,
              port: device.port,
              status: device.status ?? "unknown",
              lastChecked: new Date(),
              metadata: device.metadata,
            },
          });
          results.push(created);
        }
      }

      return results;
    });

    const response: ApiResponse<typeof syncedDevices> = {
      success: true,
      data: syncedDevices,
      meta: { total: syncedDevices.length },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "设备同步失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
