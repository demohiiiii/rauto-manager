import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markTimedOutAgents } from "@/lib/agent-timeout";
import { getEffectiveDeviceState } from "@/lib/utils";
import type {
  ApiResponse,
  DispatchType,
  ExecutionHistoryRecord,
  GlobalSearchResults,
  SearchTaskResult,
} from "@/lib/types";

const MIN_QUERY_LENGTH = 2;
const SECTION_LIMIT = 6;

function contains(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function emptyResults(query: string): GlobalSearchResults {
  return {
    query,
    total: 0,
    counts: {
      agents: 0,
      devices: 0,
      tasks: 0,
      history: 0,
    },
    agents: [],
    devices: [],
    tasks: [],
    history: [],
  };
}

function buildHistoryWhere(query: string): Prisma.ExecutionHistoryWhereInput {
  return {
    OR: [
      { command: contains(query) },
      { output: contains(query) },
      { task: { name: contains(query) } },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < MIN_QUERY_LENGTH) {
      const response: ApiResponse<GlobalSearchResults> = {
        success: true,
        data: emptyResults(query),
      };
      return NextResponse.json(response);
    }

    await markTimedOutAgents();

    const agentWhere: Prisma.AgentWhereInput = {
      OR: [
        { name: contains(query) },
        { host: contains(query) },
        { version: contains(query) },
      ],
    };
    const deviceWhere: Prisma.DeviceWhereInput = {
      OR: [
        { name: contains(query) },
        { host: contains(query) },
        { type: contains(query) },
        { agent: { name: contains(query) } },
      ],
    };
    const taskWhere: Prisma.TaskWhereInput = {
      OR: [
        { name: contains(query) },
        { description: contains(query) },
        { template: contains(query) },
      ],
    };
    const historyWhere = buildHistoryWhere(query);

    const [
      agentCount,
      deviceCount,
      taskCount,
      historyCount,
      agents,
      devices,
      tasks,
      history,
    ] = await Promise.all([
      prisma.agent.count({ where: agentWhere }),
      prisma.device.count({ where: deviceWhere }),
      prisma.task.count({ where: taskWhere }),
      prisma.executionHistory.count({ where: historyWhere }),
      prisma.agent.findMany({
        where: agentWhere,
        take: SECTION_LIMIT,
        orderBy: { lastHeartbeat: "desc" },
        select: {
          id: true,
          name: true,
          host: true,
          port: true,
          status: true,
          version: true,
          capabilities: true,
          lastHeartbeat: true,
        },
      }),
      prisma.device.findMany({
        where: deviceWhere,
        take: SECTION_LIMIT,
        orderBy: { updatedAt: "desc" },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      prisma.task.findMany({
        where: taskWhere,
        take: SECTION_LIMIT,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          dispatchType: true,
          status: true,
          createdAt: true,
          agentIds: true,
        },
      }),
      prisma.executionHistory.findMany({
        where: historyWhere,
        take: SECTION_LIMIT,
        orderBy: { createdAt: "desc" },
        include: {
          task: {
            select: {
              id: true,
              name: true,
              dispatchType: true,
            },
          },
        },
      }),
    ]);

    const historyAgentIds = Array.from(new Set(history.map((record) => record.agentId)));
    const historyDeviceIds = Array.from(
      new Set(
        history
          .map((record) => record.deviceId)
          .filter((deviceId): deviceId is string => Boolean(deviceId))
      )
    );

    const [historyAgents, historyDevices] = await Promise.all([
      historyAgentIds.length
        ? prisma.agent.findMany({
            where: { id: { in: historyAgentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      historyDeviceIds.length
        ? prisma.device.findMany({
            where: { id: { in: historyDeviceIds } },
            select: { id: true, name: true, host: true },
          })
        : Promise.resolve([]),
    ]);

    const historyAgentMap = new Map(historyAgents.map((agent) => [agent.id, agent]));
    const historyDeviceMap = new Map(historyDevices.map((device) => [device.id, device]));

    const historyRecords: ExecutionHistoryRecord[] = history.map((record) => ({
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
      agent: historyAgentMap.has(record.agentId)
        ? {
            id: record.agentId,
            name: historyAgentMap.get(record.agentId)!.name,
          }
        : undefined,
      device:
        record.deviceId && historyDeviceMap.has(record.deviceId)
          ? {
              id: record.deviceId,
              name: historyDeviceMap.get(record.deviceId)!.name,
              host: historyDeviceMap.get(record.deviceId)!.host,
            }
          : undefined,
    }));

    const taskResults: SearchTaskResult[] = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      description: task.description ?? undefined,
      dispatchType: task.dispatchType as DispatchType,
      status: task.status as SearchTaskResult["status"],
      createdAt: task.createdAt,
      agentCount: task.agentIds.length,
    }));

    const response: ApiResponse<GlobalSearchResults> = {
      success: true,
      data: {
        query,
        total: agentCount + deviceCount + taskCount + historyCount,
        counts: {
          agents: agentCount,
          devices: deviceCount,
          tasks: taskCount,
          history: historyCount,
        },
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          host: agent.host,
          port: agent.port,
          status: agent.status as GlobalSearchResults["agents"][number]["status"],
          version: agent.version ?? undefined,
          capabilities: agent.capabilities,
          lastHeartbeat: agent.lastHeartbeat,
        })),
        devices: devices.map((device) => {
          const effectiveState = getEffectiveDeviceState(
            device.status,
            device.agent?.status
          );

          return {
            id: device.id,
            name: device.name,
            type: device.type,
            host: device.host,
            port: device.port ?? undefined,
            status: effectiveState.status,
            statusReason: effectiveState.statusReason,
            agent: device.agent
              ? {
                  id: device.agent.id,
                  name: device.agent.name,
                  status: device.agent.status,
                }
              : undefined,
          };
        }),
        tasks: taskResults,
        history: historyRecords,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "全局搜索失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
