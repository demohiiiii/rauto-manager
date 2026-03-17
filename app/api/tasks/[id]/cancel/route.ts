import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/tasks/[id]/cancel
 * 取消一个 pending 或 running 状态的任务
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const t = await getSystemTranslator();

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 }
      );
    }

    if (task.status !== "pending" && task.status !== "running") {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 }
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "cancelled",
        completedAt: new Date(),
      },
      include: {
        agents: true,
      },
    });

    // 创建通知
    createNotification({
      type: "task_failed",
      title: t("notifications.taskCancelled"),
      message: t("notifications.taskCancelledMessage", { name: task.name }),
      level: "warning",
      metadata: { taskId: task.id },
    }).catch(() => {});

    const response: ApiResponse<typeof updatedTask> = {
      success: true,
      data: updatedTask,
    };

    return NextResponse.json(response);
  } catch (error) {
    const t = await getSystemTranslator();
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("common.saveFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
