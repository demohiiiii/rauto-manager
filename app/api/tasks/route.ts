import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        agents: true,
        executionHistory: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const response: ApiResponse<typeof tasks> = {
      success: true,
      data: tasks,
      meta: {
        total: tasks.length,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取任务列表失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newTask = await prisma.task.create({
      data: {
        name: body.name,
        description: body.description,
        agentIds: body.agentIds || [],
        deviceIds: body.deviceIds || [],
        template: body.template,
        variables: body.variables || {},
        status: "pending",
      },
      include: {
        agents: true,
      },
    });

    const response: ApiResponse<typeof newTask> = {
      success: true,
      data: newTask,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少任务 ID" },
        { status: 400 }
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: body.status,
        result: body.result,
        startedAt: body.status === "running" ? new Date() : undefined,
        completedAt: ["success", "failed", "cancelled"].includes(body.status)
          ? new Date()
          : undefined,
      },
      include: {
        agents: true,
      },
    });

    const response: ApiResponse<typeof updatedTask> = {
      success: true,
      data: updatedTask,
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "更新任务失败",
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
        { success: false, error: "缺少任务 ID" },
        { status: 400 }
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "删除任务失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
