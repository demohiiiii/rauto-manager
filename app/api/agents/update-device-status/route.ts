import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";

interface DeviceStatus {
  name: string;
  host: string;
  reachable: boolean;
}

interface UpdateDeviceStatusBody {
  name: string; // agent name
  devices: DeviceStatus[];
}

export async function POST(request: NextRequest) {
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: UpdateDeviceStatusBody = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: name" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.devices)) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: devices (数组)" },
        { status: 400 }
      );
    }

    // 查找 Agent
    const agent = await prisma.agent.findUnique({
      where: { name: body.name },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent 不存在: ${body.name}` },
        { status: 404 }
      );
    }

    // 批量更新设备状态
    const updatedCount = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const device of body.devices) {
        const status = device.reachable ? "reachable" : "unreachable";

        // 根据 name + host 查找设备
        const result = await tx.device.updateMany({
          where: {
            agentId: agent.id,
            name: device.name,
            host: device.host,
          },
          data: {
            status,
            lastChecked: new Date(),
          },
        });

        count += result.count;
      }

      return count;
    });

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      data: { updated: updatedCount },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "设备状态更新失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
