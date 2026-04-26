import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { dispatchToAgent, isAsyncDispatchType } from "@/lib/dispatch";
import { parseInvalidProfileModeError } from "@/lib/profile-mode";
import {
  getDefaultRecordLevelForType,
  normalizeRecordLevel,
} from "@/lib/record-level";
import { createNotification } from "@/lib/notification";
import type { DispatchType } from "@/lib/types";
import type { Prisma } from "@prisma/client";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import {
  buildConnectionPayloadFromInput,
  isAgentAvailableStatus,
} from "@/lib/utils";

/**
 * POST /api/tasks/[id]/execute
 * Execute a task that is still in the pending state.
 *
 * Read dispatchType, payload, and agentIds[0] from the task record,
 * then send the request to the agent through dispatchToAgent().
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const t = await getSystemTranslator();

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 },
      );
    }

    if (task.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 },
      );
    }

    if (!task.agentIds.length) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 },
      );
    }

    // Look up the agent
    const agent = await prisma.agent.findUnique({
      where: { id: task.agentIds[0] },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 },
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        {
          success: false,
          error: t("common.missingRequiredFields"),
        },
        { status: 400 },
      );
    }

    const dispatchType = task.dispatchType as DispatchType;
    const asyncDispatch = isAsyncDispatchType(dispatchType);
    const dispatchingEventCreatedAt = new Date();

    // Record that manager has started the dispatch flow.
    await prisma.$transaction(async (tx) => {
      if (!asyncDispatch) {
        await tx.task.update({
          where: { id },
          data: {
            status: "running",
            startedAt: new Date(),
          },
        });
      }

      await tx.taskExecutionEvent.create({
        data: {
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          eventType: "dispatching",
          level: "info",
          stage: "manager",
          message: t("tasks.eventDispatching", { name: agent.name }),
          progress: 0,
          createdAt: dispatchingEventCreatedAt,
          details: {
            dispatchType,
          },
        },
      });
    });

    const payload = (task.payload ?? {}) as Record<string, unknown>;

    // Extract connection if it exists inside the payload
    const connection = buildConnectionPayloadFromInput(
      (payload.connection as Record<string, unknown> | undefined) ?? undefined,
    );
    const dryRun = payload.dry_run as boolean | undefined;
    const recordLevel =
      normalizeRecordLevel(payload.record_level) ??
      getDefaultRecordLevelForType(dispatchType);

    // Build a clean payload without the meta field
    const purePayload = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          key !== "connection" && key !== "dry_run" && key !== "record_level",
      ),
    );

    try {
      const dispatchResult = await dispatchToAgent({
        agent: {
          host: agent.host,
          port: agent.port,
          reportMode: agent.reportMode === "grpc" ? "grpc" : "http",
        },
        type: dispatchType,
        taskId: task.id,
        connection,
        payload: purePayload,
        dryRun: dryRun,
        recordLevel: recordLevel,
      });

      const taskStatus =
        dispatchResult.executionMode === "async" ? "queued" : "running";
      const acceptedEventCreatedAt = new Date(
        dispatchingEventCreatedAt.getTime() + 1,
      );

      await prisma.$transaction(async (tx) => {
        if (dispatchResult.executionMode === "async") {
          await tx.task.updateMany({
            where: {
              id: task.id,
              status: "pending",
            },
            data: {
              status: "queued",
            },
          });
        }

        await tx.taskExecutionEvent.create({
          data: {
            taskId: task.id,
            agentId: agent.id,
            agentName: agent.name,
            eventType:
              dispatchResult.executionMode === "async"
                ? "queued"
                : "dispatched",
            level: "info",
            stage: "manager",
            message:
              dispatchResult.executionMode === "async"
                ? t("tasks.eventAccepted", { name: agent.name })
                : t("tasks.eventDispatched", { name: agent.name }),
            progress: dispatchResult.executionMode === "async" ? 0 : 10,
            createdAt: acceptedEventCreatedAt,
            details: {
              dispatchType,
              executionMode: dispatchResult.executionMode,
              agentResponse: dispatchResult.response,
            } as Prisma.InputJsonValue,
          },
        });
      });

      // Notification: task execution started
      createNotification({
        type: "task_dispatched",
        title: t("notifications.taskDispatched"),
        message: t("notifications.taskDispatchedTo", {
          name: agent.name,
          type: t(`tasks.dispatchType.${dispatchType}`),
        }),
        level: "info",
        metadata: {
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          dispatchType,
          executionMode: dispatchResult.executionMode,
        },
      }).catch(() => {});

      const response: ApiResponse<{
        task_id: string;
        accepted: boolean;
        dispatched: boolean;
        agent_name: string;
        dispatch_type: DispatchType;
        task_status: "queued" | "running";
        execution_mode: "sync" | "async";
      }> = {
        success: true,
        data: {
          task_id: task.id,
          accepted: true,
          dispatched: true,
          agent_name: agent.name,
          dispatch_type: dispatchType,
          task_status: taskStatus,
          execution_mode: dispatchResult.executionMode,
        },
      };

      return NextResponse.json(response);
    } catch (dispatchError) {
      const t = await getSystemTranslator();
      const dispatchErrorMessage =
        dispatchError instanceof Error
          ? dispatchError.message
          : t("common.saveFailed");
      const invalidProfileMode =
        parseInvalidProfileModeError(dispatchErrorMessage);
      const normalizedDispatchErrorMessage = invalidProfileMode
        ? t("dialogs.invalidProfileMode", {
            mode: invalidProfileMode.requestedMode,
            profile: invalidProfileMode.profile,
            defaultMode: invalidProfileMode.defaultMode,
            availableModes:
              invalidProfileMode.availableModes.join(", ") || t("common.none"),
          })
        : dispatchErrorMessage;
      // If the agent call fails, mark the task as failed
      await prisma.$transaction([
        prisma.task.update({
          where: { id },
          data: {
            status: "failed",
            completedAt: new Date(),
            result: {
              success: false,
              error: normalizedDispatchErrorMessage,
            },
          },
        }),
        prisma.taskExecutionEvent.create({
          data: {
            taskId: task.id,
            agentId: agent.id,
            agentName: agent.name,
            eventType: "failed",
            level: "error",
            stage: "manager",
            message: t("tasks.eventDispatchFailed", {
              name: agent.name,
              error: normalizedDispatchErrorMessage,
            }),
            details: {
              dispatchType,
            },
          },
        }),
      ]);

      return NextResponse.json(
        {
          success: false,
          error: normalizedDispatchErrorMessage,
        },
        { status: invalidProfileMode ? 400 : 502 },
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
