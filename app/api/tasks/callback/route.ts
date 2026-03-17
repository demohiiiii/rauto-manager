import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, TaskCallbackInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

export async function POST(request: NextRequest) {
  // Validate the API key
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: TaskCallbackInput = await request.json();
    const t = await getSystemTranslator();

    // Validate required fields
    if (!body.task_id || !body.agent_name || !body.status) {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 }
      );
    }

    // Validate the status value
    if (!["success", "failed"].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // Update the task and create execution history inside a transaction
    const updatedTask = await prisma.$transaction(async (tx) => {
      // Find the matching agent
      const agent = await tx.agent.findUnique({
        where: { name: body.agent_name },
      });

      if (!agent) {
        throw new Error(t("common.agentNotFound", { name: body.agent_name }));
      }

      // Ensure the task exists
      const task = await tx.task.findUnique({
        where: { id: body.task_id },
      });

      if (!task) {
        throw new Error(t("common.taskNotFound", { id: body.task_id }));
      }

      // Update the task status
      const resultData: Prisma.InputJsonValue =
        body.status === "success"
          ? ((body.result as Prisma.InputJsonValue) ?? { success: true })
          : { success: false, error: body.error ?? "Unknown error" };

      const updated = await tx.task.update({
        where: { id: body.task_id },
        data: {
          status: body.status,
          startedAt: body.started_at ? new Date(body.started_at) : undefined,
          completedAt: body.completed_at
            ? new Date(body.completed_at)
            : new Date(),
          result: resultData,
        },
      });

      // Create the execution history record
      await tx.executionHistory.create({
        data: {
          taskId: body.task_id,
          agentId: agent.id,
          command: `task:${task.template}`,
          output:
            body.status === "success"
              ? JSON.stringify(body.result ?? {})
              : (body.error ?? "Unknown error"),
          status: body.status,
          executionTime: body.execution_time_ms ?? 0,
        },
      });

      return { task: updated, agent };
    });

    // Notification: task execution result
    createNotification({
      type: body.status === "success" ? "task_success" : "task_failed",
      title: body.status === "success" ? t("notifications.taskSuccess") : t("notifications.taskFailed"),
      message:
        body.status === "success"
          ? t("notifications.taskCompletedSuccess", { name: body.agent_name, taskName: updatedTask.task.name })
          : t("notifications.taskCompletedFailed", { name: body.agent_name, taskName: updatedTask.task.name, error: body.error ?? "Unknown error" }),
      level: body.status === "success" ? "success" : "error",
      metadata: {
        taskId: body.task_id,
        agentId: updatedTask.agent.id,
        agentName: body.agent_name,
        status: body.status,
      },
    }).catch(() => {});

    const response: ApiResponse<null> = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    const t = await getSystemTranslator();
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("notifications.taskCallbackFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
