import { NextRequest, NextResponse } from "next/server";
import type {
  ApiResponse,
  ConnectionPayload,
  DispatchRequest,
  DispatchType,
} from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dispatchToAgent, isAsyncDispatchType } from "@/lib/dispatch";
import { parseInvalidProfileModeError } from "@/lib/profile-mode";
import {
  getDefaultRecordLevelForType,
  normalizeRecordLevel,
} from "@/lib/record-level";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import { hasTxBlockDispatchInput } from "@/lib/tx-block-serialize";
import {
  buildConnectionPayloadFromInput,
  isAgentAvailableStatus,
} from "@/lib/utils";

const VALID_TYPES: DispatchType[] = [
  "exec",
  "template",
  "tx_block",
  "tx_workflow",
  "orchestrate",
];

export async function POST(request: NextRequest) {
  try {
    const body: DispatchRequest = await request.json();
    const t = await getSystemTranslator();

    // Validate required fields
    if (!body.type || !body.agent_id || !body.payload) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 },
      );
    }

    // Validate the dispatch type
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的 type: ${body.type}，支持: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Ensure exec requests include a command
    if (body.type === "exec" && !body.payload.command) {
      return NextResponse.json(
        { success: false, error: "exec 类型必须提供 payload.command" },
        { status: 400 },
      );
    }

    // Ensure template requests include a template
    if (body.type === "template" && !body.payload.template) {
      return NextResponse.json(
        { success: false, error: "template 类型必须提供 payload.template" },
        { status: 400 },
      );
    }

    // Ensure tx_block requests include commands
    if (body.type === "tx_block" && !hasTxBlockDispatchInput(body.payload)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "tx_block 类型必须提供非空 payload.commands、payload.template 或 payload.template_content",
        },
        { status: 400 },
      );
    }

    // Ensure tx_workflow requests include a workflow
    if (body.type === "tx_workflow" && !body.payload.workflow) {
      return NextResponse.json(
        { success: false, error: "tx_workflow 类型必须提供 payload.workflow" },
        { status: 400 },
      );
    }

    // Ensure orchestrate requests include a plan
    if (body.type === "orchestrate" && !body.payload.plan) {
      return NextResponse.json(
        { success: false, error: "orchestrate 类型必须提供 payload.plan" },
        { status: 400 },
      );
    }

    // Look up the agent
    const agent = await prisma.agent.findUnique({
      where: { id: body.agent_id },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 },
      );
    }

    if (!isAgentAvailableStatus(agent.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent 当前状态为 ${agent.status}，无法下发任务`,
        },
        { status: 400 },
      );
    }

    // Build the task name
    const typeLabel = t(`tasks.dispatchType.${body.type}`);
    const taskName = `[${typeLabel}] ${summarizePayload(body)}`;
    const asyncDispatch = isAsyncDispatchType(body.type);
    const dispatchingEventCreatedAt = new Date();
    const effectiveRecordLevel =
      normalizeRecordLevel(body.record_level) ??
      getDefaultRecordLevelForType(body.type);
    const normalizedConnection = buildConnectionPayloadFromInput(
      body.connection as Record<string, unknown> | undefined,
    );
    const storedPayload: Record<string, unknown> = {
      ...body.payload,
      ...(normalizedConnection ? { connection: normalizedConnection } : {}),
      ...(body.dry_run !== undefined ? { dry_run: body.dry_run } : {}),
      record_level: effectiveRecordLevel,
    };

    // Create the task record
    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          name: taskName,
          agentIds: [agent.id],
          dispatchType: body.type,
          payload: storedPayload as Prisma.InputJsonValue,
          status: asyncDispatch ? "pending" : "running",
          startedAt: asyncDispatch ? undefined : new Date(),
        },
      });

      await tx.taskExecutionEvent.create({
        data: {
          taskId: createdTask.id,
          agentId: agent.id,
          agentName: agent.name,
          eventType: "dispatching",
          level: "info",
          stage: "manager",
          message: t("tasks.eventDispatching", { name: agent.name }),
          progress: 0,
          createdAt: dispatchingEventCreatedAt,
          details: {
            dispatchType: body.type,
          },
        },
      });

      return createdTask;
    });

    try {
      // Call the agent
      const dispatchResult = await dispatchToAgent({
        agent: {
          host: agent.host,
          port: agent.port,
          reportMode: agent.reportMode === "grpc" ? "grpc" : "http",
        },
        type: body.type,
        taskId: task.id,
        connection: normalizedConnection as ConnectionPayload | undefined,
        payload: body.payload as Record<string, unknown>,
        dryRun: body.dry_run,
        recordLevel: effectiveRecordLevel,
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
              dispatchType: body.type,
              executionMode: dispatchResult.executionMode,
              agentResponse: dispatchResult.response,
            } as Prisma.InputJsonValue,
          },
        });
      });

      const response: ApiResponse<{
        task_id: string;
        accepted: boolean;
        dispatched: boolean;
        agent_name: string;
        dispatch_type: string;
        task_status: "queued" | "running";
        execution_mode: "sync" | "async";
      }> = {
        success: true,
        data: {
          task_id: task.id,
          accepted: true,
          dispatched: true,
          agent_name: agent.name,
          dispatch_type: body.type,
          task_status: taskStatus,
          execution_mode: dispatchResult.executionMode,
        },
      };

      // Notification: task dispatched
      createNotification({
        type: "task_dispatched",
        title: t("notifications.taskDispatched"),
        message: t("notifications.taskDispatchedTo", {
          name: agent.name,
          type: t(`tasks.dispatchType.${body.type}`),
        }),
        level: "info",
        metadata: {
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          dispatchType: body.type,
        },
      }).catch(() => {});

      return NextResponse.json(response);
    } catch (dispatchError) {
      // If the agent call fails, mark the task as failed
      const dispatchErrorMessage =
        dispatchError instanceof Error
          ? dispatchError.message
          : "Agent 调用失败";
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

      await prisma.$transaction([
        prisma.task.update({
          where: { id: task.id },
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
              dispatchType: body.type,
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
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "下发请求处理失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Generate a task summary
 */
function summarizePayload(req: DispatchRequest): string {
  switch (req.type) {
    case "exec":
      return String(req.payload.command ?? "").slice(0, 60);
    case "template":
      return String(req.payload.template ?? "");
    case "tx_block":
      return req.payload.name
        ? String(req.payload.name)
        : `${(req.payload.commands as string[])?.length ?? 0} commands`;
    case "tx_workflow":
      return "workflow";
    case "orchestrate":
      return "orchestration plan";
    default:
      return req.type;
  }
}
