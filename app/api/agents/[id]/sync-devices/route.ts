import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
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
