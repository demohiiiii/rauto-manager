import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, DispatchRequest, DispatchType } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dispatchToAgent } from "@/lib/dispatch";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

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
        { status: 400 }
      );
    }

    // Validate the dispatch type
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的 type: ${body.type}，支持: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Ensure exec requests include a command
    if (body.type === "exec" && !body.payload.command) {
      return NextResponse.json(
        { success: false, error: "exec 类型必须提供 payload.command" },
        { status: 400 }
      );
    }

    // Ensure template requests include a template
    if (body.type === "template" && !body.payload.template) {
      return NextResponse.json(
        { success: false, error: "template 类型必须提供 payload.template" },
        { status: 400 }
      );
    }

    // Ensure tx_block requests include commands
    if (body.type === "tx_block" && !Array.isArray(body.payload.commands)) {
      return NextResponse.json(
        { success: false, error: "tx_block 类型必须提供 payload.commands 数组" },
        { status: 400 }
      );
    }

    // Ensure tx_workflow requests include a workflow
    if (body.type === "tx_workflow" && !body.payload.workflow) {
      return NextResponse.json(
        { success: false, error: "tx_workflow 类型必须提供 payload.workflow" },
        { status: 400 }
      );
    }

    // Ensure orchestrate requests include a plan
    if (body.type === "orchestrate" && !body.payload.plan) {
      return NextResponse.json(
        { success: false, error: "orchestrate 类型必须提供 payload.plan" },
        { status: 400 }
      );
    }

    // Look up the agent
    const agent = await prisma.agent.findUnique({
      where: { id: body.agent_id },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent 不存在" },
        { status: 404 }
      );
    }

    if (agent.status !== "online" && agent.status !== "busy") {
      return NextResponse.json(
        {
          success: false,
          error: `Agent 当前状态为 ${agent.status}，无法下发任务`,
        },
        { status: 400 }
      );
    }

    // Build the task name
    const typeLabel = t(`tasks.dispatchType.${body.type}`);
    const taskName = `[${typeLabel}] ${summarizePayload(body)}`;

    // Create the task record
    const task = await prisma.task.create({
      data: {
        name: taskName,
        agentIds: [agent.id],
        dispatchType: body.type,
        payload: body.payload as Prisma.InputJsonValue,
        status: "running",
        startedAt: new Date(),
      },
    });

    // Build the callback URL from the current request origin
    const callbackUrl = new URL(
      "/api/agents/report-task-callback",
      request.nextUrl.origin
    ).toString();

    try {
      // Call the agent
      await dispatchToAgent({
        agent: { host: agent.host, port: agent.port },
        type: body.type,
        taskId: task.id,
        callbackUrl,
        connection: body.connection as Record<string, unknown> | undefined,
        payload: body.payload as Record<string, unknown>,
        dryRun: body.dry_run,
        recordLevel: body.record_level,
      });

      const response: ApiResponse<{
        task_id: string;
        dispatched: boolean;
        agent_name: string;
        dispatch_type: string;
      }> = {
        success: true,
        data: {
          task_id: task.id,
          dispatched: true,
          agent_name: agent.name,
          dispatch_type: body.type,
        },
      };

      // Notification: task dispatched
      createNotification({
        type: "task_dispatched",
        title: t("notifications.taskDispatched"),
        message: t("notifications.taskDispatchedTo", {
          name: agent.name,
          type: t(`tasks.dispatchType.${body.type}`)
        }),
        level: "info",
        metadata: { taskId: task.id, agentId: agent.id, agentName: agent.name, dispatchType: body.type },
      }).catch(() => {});

      return NextResponse.json(response);
    } catch (dispatchError) {
      // If the agent call fails, mark the task as failed
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          result: {
            success: false,
            error:
              dispatchError instanceof Error
                ? dispatchError.message
                : "Agent 调用失败",
          },
        },
      });

      return NextResponse.json(
        {
          success: false,
          error:
            dispatchError instanceof Error
              ? dispatchError.message
              : "Agent 调用失败",
        },
        { status: 502 }
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
