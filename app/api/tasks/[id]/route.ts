import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        executionHistory: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        executionEvents: {
          orderBy: {
            createdAt: "asc",
          },
          take: 200,
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: "任务不存在" },
        { status: 404 }
      );
    }

    const response: ApiResponse<typeof task> = {
      success: true,
      data: task,
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取任务详情失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
