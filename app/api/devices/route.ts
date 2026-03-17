import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { serializeAgent } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get("agentId");

    const devices = await prisma.device.findMany({
      where: agentId ? { agentId } : undefined,
      include: {
        agent: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Agent objects include BigInt fields, so serialize them before returning JSON
    const serializable = devices.map((d) => ({
      ...d,
      agent: serializeAgent(d.agent),
    }));

    const response: ApiResponse<typeof serializable> = {
      success: true,
      data: serializable,
      meta: {
        total: devices.length,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取设备列表失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newDevice = await prisma.device.create({
      data: {
        agentId: body.agentId,
        name: body.name,
        type: body.type,
        host: body.host,
        port: body.port,
        status: "unknown",
        metadata: body.metadata || {},
      },
      include: {
        agent: true,
      },
    });

    const serialized = { ...newDevice, agent: serializeAgent(newDevice.agent) };

    return NextResponse.json({ success: true, data: serialized }, { status: 201 });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "创建设备失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少设备 ID" },
        { status: 400 }
      );
    }

    await prisma.device.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "删除设备失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
