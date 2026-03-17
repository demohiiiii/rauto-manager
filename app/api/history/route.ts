import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ApiResponse,
  DispatchType,
  ExecutionHistoryRecord,
  ExecutionHistoryStats,
} from "@/lib/types";

type HistoryRange = "all" | "24h" | "7d" | "30d";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getRangeStart(range: HistoryRange): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return undefined;
  }
}

function buildWhereClause(request: NextRequest): Prisma.ExecutionHistoryWhereInput {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const status = request.nextUrl.searchParams.get("status");
  const agentId = request.nextUrl.searchParams.get("agentId")?.trim();
  const range = (request.nextUrl.searchParams.get("range") ?? "all") as HistoryRange;

  const where: Prisma.ExecutionHistoryWhereInput = {};

  if (status === "success" || status === "failed") {
    where.status = status;
  }

  if (agentId) {
    where.agentId = agentId;
  }

  const rangeStart = getRangeStart(range);
  if (rangeStart) {
    where.createdAt = {
      gte: rangeStart,
    };
  }

  if (search) {
    where.OR = [
      { command: { contains: search, mode: "insensitive" } },
      { output: { contains: search, mode: "insensitive" } },
      { task: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const where = buildWhereClause(request);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20),
      100
    );
    const skip = (page - 1) * limit;

    const statusFilter = where.status;

    const [
      totalExecutions,
      averageDurationResult,
      successCountValue,
      failedCountValue,
      history,
    ] = await Promise.all([
      prisma.executionHistory.count({ where }),
      prisma.executionHistory.aggregate({
        where,
        _avg: {
          executionTime: true,
        },
      }),
      statusFilter === "success"
        ? Promise.resolve(0)
        : prisma.executionHistory.count({
            where: {
              ...where,
              status: "success",
            },
          }),
      statusFilter === "failed"
        ? Promise.resolve(0)
        : prisma.executionHistory.count({
            where: {
              ...where,
              status: "failed",
            },
          }),
      prisma.executionHistory.findMany({
        where,
        include: {
          task: {
            select: {
              id: true,
              name: true,
              dispatchType: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
    ]);

    const agentIds = Array.from(new Set(history.map((record) => record.agentId)));
    const deviceIds = Array.from(
      new Set(
        history
          .map((record) => record.deviceId)
          .filter((deviceId): deviceId is string => Boolean(deviceId))
      )
    );

    const [agents, devices] = await Promise.all([
      agentIds.length
        ? prisma.agent.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      deviceIds.length
        ? prisma.device.findMany({
            where: { id: { in: deviceIds } },
            select: { id: true, name: true, host: true },
          })
        : Promise.resolve([]),
    ]);

    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    const deviceMap = new Map(devices.map((device) => [device.id, device]));

    const records: ExecutionHistoryRecord[] = history.map((record) => ({
      id: record.id,
      taskId: record.taskId,
      agentId: record.agentId,
      deviceId: record.deviceId ?? undefined,
      command: record.command,
      output: record.output,
      status: record.status as "success" | "failed",
      executionTime: record.executionTime,
      createdAt: record.createdAt,
      task: record.task
        ? {
            id: record.task.id,
            name: record.task.name,
            dispatchType: record.task.dispatchType as DispatchType,
          }
        : undefined,
      agent: agentMap.has(record.agentId)
        ? {
            id: record.agentId,
            name: agentMap.get(record.agentId)!.name,
          }
        : undefined,
      device:
        record.deviceId && deviceMap.has(record.deviceId)
          ? {
              id: record.deviceId,
              name: deviceMap.get(record.deviceId)!.name,
              host: deviceMap.get(record.deviceId)!.host,
            }
          : undefined,
    }));

    const successCount =
      statusFilter === "success"
        ? totalExecutions
        : statusFilter === "failed"
          ? 0
          : successCountValue;
    const failedCount =
      statusFilter === "failed"
        ? totalExecutions
        : statusFilter === "success"
          ? 0
          : failedCountValue;
    const averageDuration = Math.round(
      averageDurationResult._avg.executionTime ?? 0
    );
    const successRate = totalExecutions
      ? Math.round((successCount / totalExecutions) * 100)
      : 0;

    const response: ApiResponse<{
      records: ExecutionHistoryRecord[];
      stats: ExecutionHistoryStats;
    }> = {
      success: true,
      data: {
        records,
        stats: {
          totalExecutions,
          successCount,
          failedCount,
          successRate,
          averageDuration,
        },
      },
      meta: {
        total: totalExecutions,
        page,
        limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "获取执行历史失败",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
