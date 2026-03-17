import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { dispatchToAgent } from "@/lib/dispatch";
import { createNotification } from "@/lib/notification";
import type { DispatchType } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/tasks/[id]/execute
 * 执行一个 pending 状态的任务
 *
 * 从 Task 记录中取出 dispatchType + payload + agentIds[0]，
 * 调用 dispatchToAgent() 发送到 Agent
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

    if (task.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 }
      );
    }

    if (!task.agentIds.length) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // 查找 Agent
    const agent = await prisma.agent.findUnique({
      where: { id: task.agentIds[0] },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 }
      );
    }

    if (agent.status !== "online" && agent.status !== "busy") {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 }
      );
    }

    // 更新状态为 running
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // 构造回调 URL
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
    const callbackUrl = `${baseUrl}/tasks/callback`;

    const payload = (task.payload ?? {}) as Record<string, unknown>;
    const dispatchType = task.dispatchType as DispatchType;

    // 提取 connection（如果 payload 中包含）
    const connection = payload.connection as
      | Record<string, unknown>
      | undefined;
    const dryRun = payload.dry_run as boolean | undefined;
    const recordLevel = payload.record_level as string | undefined;

    // 构建不含 meta 字段的纯 payload
    const { connection: _conn, dry_run: _dry, record_level: _rec, ...purePayload } = payload;

    try {
      await dispatchToAgent({
        agent: { host: agent.host, port: agent.port },
        type: dispatchType,
        taskId: task.id,
        callbackUrl,
        connection,
        payload: purePayload,
        dryRun: dryRun,
        recordLevel: recordLevel,
      });

      // 通知：任务执行
      createNotification({
        type: "task_dispatched",
        title: t("notifications.taskDispatched"),
        message: t("notifications.taskDispatchedTo", {
          name: agent.name,
          type: t(`tasks.dispatchType.${dispatchType}`)
        }),
        level: "info",
        metadata: {
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          dispatchType,
        },
      }).catch(() => {});

      const response: ApiResponse<{ task_id: string; dispatched: boolean }> = {
        success: true,
        data: {
          task_id: task.id,
          dispatched: true,
        },
      };

      return NextResponse.json(response);
    } catch (dispatchError) {
      const t = await getSystemTranslator();
      // Agent 调用失败，更新 Task 为 failed
      await prisma.task.update({
        where: { id },
        data: {
          status: "failed",
          completedAt: new Date(),
          result: {
            success: false,
            error:
              dispatchError instanceof Error
                ? dispatchError.message
                : t("common.saveFailed"),
          },
        },
      });

      return NextResponse.json(
        {
          success: false,
          error:
            dispatchError instanceof Error
              ? dispatchError.message
              : t("common.saveFailed"),
        },
        { status: 502 }
      );
    }
  } catch (error) {
    const t = await getSystemTranslator();
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("common.saveFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
