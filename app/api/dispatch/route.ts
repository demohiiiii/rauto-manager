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

    // 验证必填字段
    if (!body.type || !body.agent_id || !body.payload) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // 验证 dispatch type
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的 type: ${body.type}，支持: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 验证 exec 类型必须有 command
    if (body.type === "exec" && !body.payload.command) {
      return NextResponse.json(
        { success: false, error: "exec 类型必须提供 payload.command" },
        { status: 400 }
      );
    }

    // 验证 template 类型必须有 template
    if (body.type === "template" && !body.payload.template) {
      return NextResponse.json(
        { success: false, error: "template 类型必须提供 payload.template" },
        { status: 400 }
      );
    }

    // 验证 tx_block 类型必须有 commands
    if (body.type === "tx_block" && !Array.isArray(body.payload.commands)) {
      return NextResponse.json(
        { success: false, error: "tx_block 类型必须提供 payload.commands 数组" },
        { status: 400 }
      );
    }

    // 验证 tx_workflow 类型必须有 workflow
    if (body.type === "tx_workflow" && !body.payload.workflow) {
      return NextResponse.json(
        { success: false, error: "tx_workflow 类型必须提供 payload.workflow" },
        { status: 400 }
      );
    }

    // 验证 orchestrate 类型必须有 plan
    if (body.type === "orchestrate" && !body.payload.plan) {
      return NextResponse.json(
        { success: false, error: "orchestrate 类型必须提供 payload.plan" },
        { status: 400 }
      );
    }

    // 查找 Agent
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

    // 构造任务名称
    const typeLabel = t(`tasks.dispatchType.${body.type}`);
    const taskName = `[${typeLabel}] ${summarizePayload(body)}`;

    // 创建 Task 记录
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

    // 构造回调 URL
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
    const callbackUrl = `${baseUrl}/tasks/callback`;

    try {
      // 调用 Agent
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

      // 通知：任务下发
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
      // Agent 调用失败，更新 Task 为 failed
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
 * 生成任务摘要
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
