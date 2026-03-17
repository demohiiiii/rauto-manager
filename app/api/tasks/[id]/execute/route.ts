import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { dispatchToAgent } from "@/lib/dispatch";
import { createNotification } from "@/lib/notification";
import type { DispatchType } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/tasks/[id]/execute
 * Execute a task that is still in the pending state.
 *
 * Read dispatchType, payload, and agentIds[0] from the task record,
 * then send the request to the agent through dispatchToAgent().
 */
export async function POST(
  request: NextRequest,
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

    // Look up the agent
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

    // Mark the task as running
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // Build the callback URL from the current request origin
    const callbackUrl = new URL("/api/tasks/callback", request.nextUrl.origin).toString();

    const payload = (task.payload ?? {}) as Record<string, unknown>;
    const dispatchType = task.dispatchType as DispatchType;

    // Extract connection if it exists inside the payload
    const connection = payload.connection as
      | Record<string, unknown>
      | undefined;
    const dryRun = payload.dry_run as boolean | undefined;
    const recordLevel = payload.record_level as string | undefined;

    // Build a clean payload without the meta field
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

      // Notification: task execution started
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
      // If the agent call fails, mark the task as failed
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
