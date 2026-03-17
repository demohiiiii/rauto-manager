import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { serializeAgent } from "@/lib/utils";

export async function GET() {
  try {
    // 并行查询所有统计数据
    const [
      agents,
      devices,
      todayTasks,
      recentTasks,
      weekTasks,
      recentNotifications,
    ] = await Promise.all([
      // Agent 统计
      prisma.agent.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          lastHeartbeat: true,
          uptimeSeconds: true,
        },
      }),

      // 设备统计
      prisma.device.findMany({
        select: {
          status: true,
        },
      }),

      // 今日任务统计
      prisma.task.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        select: {
          status: true,
        },
      }),

      // 最近 5 条任务（用于最近活动）
      prisma.task.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          dispatchType: true,
        },
      }),

      // 过去 7 天任务统计
      prisma.task.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          status: true,
        },
      }),

      // 最近 3 条通知
      prisma.notification.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          level: true,
          createdAt: true,
        },
      }),
    ]);

    // Agent 统计
    const onlineAgents = agents.filter((a) => a.status === "online");
    const activeAgentCount = onlineAgents.length;

    // 设备统计
    const totalDevices = devices.length;
    const onlineDevices = devices.filter((d) => d.status === "reachable").length;
    const offlineDevices = totalDevices - onlineDevices;

    // 今日任务统计
    const todayTotal = todayTasks.length;
    const todaySuccess = todayTasks.filter((t) => t.status === "success").length;
    const todayFailed = todayTasks.filter((t) => t.status === "failed").length;

    // 过去 7 天任务统计
    const weekTotal = weekTasks.length;
    const weekSuccess = weekTasks.filter((t) => t.status === "success").length;
    const weekRunning = weekTasks.filter((t) => t.status === "running").length;
    const weekFailed = weekTasks.filter((t) => t.status === "failed").length;

    // 系统健康度计算（基于在线 Agent 比例和任务成功率）
    const agentHealthScore = agents.length > 0 ? (activeAgentCount / agents.length) * 100 : 100;
    const taskHealthScore = weekTotal > 0 ? (weekSuccess / weekTotal) * 100 : 100;
    const systemHealth = Math.round((agentHealthScore + taskHealthScore) / 2);

    const response: ApiResponse<{
      stats: {
        activeAgents: number;
        totalAgents: number;
        totalDevices: number;
        onlineDevices: number;
        offlineDevices: number;
        todayTasks: number;
        todaySuccess: number;
        todayFailed: number;
        systemHealth: number;
      };
      recentActivity: Array<{
        id: string;
        name: string;
        status: string;
        type: string;
        createdAt: Date;
      }>;
      taskStats: {
        success: number;
        running: number;
        failed: number;
        total: number;
      };
      recentNotifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        level: string;
        createdAt: Date;
      }>;
      topAgents: Array<{
        id: string;
        name: string;
        status: string;
        uptime: number;
      }>;
    }> = {
      success: true,
      data: {
        stats: {
          activeAgents: activeAgentCount,
          totalAgents: agents.length,
          totalDevices,
          onlineDevices,
          offlineDevices,
          todayTasks: todayTotal,
          todaySuccess,
          todayFailed,
          systemHealth,
        },
        recentActivity: recentTasks.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          type: t.dispatchType,
          createdAt: t.createdAt,
        })),
        taskStats: {
          success: weekSuccess,
          running: weekRunning,
          failed: weekFailed,
          total: weekTotal,
        },
        recentNotifications: recentNotifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          level: n.level,
          createdAt: n.createdAt,
        })),
        topAgents: onlineAgents
          .map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
            uptime: Number(a.uptimeSeconds),
          }))
          .sort((a, b) => b.uptime - a.uptime)
          .slice(0, 5),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取仪表盘数据失败",
      },
      { status: 500 }
    );
  }
}
