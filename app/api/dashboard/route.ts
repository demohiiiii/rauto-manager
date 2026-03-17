import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { serializeAgent } from "@/lib/utils";

export async function GET() {
  try {
    // Query all dashboard stats in parallel
    const [
      agents,
      devices,
      todayTasks,
      recentTasks,
      weekTasks,
      recentNotifications,
    ] = await Promise.all([
      // Agent stats
      prisma.agent.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          lastHeartbeat: true,
          uptimeSeconds: true,
        },
      }),

      // Device stats
      prisma.device.findMany({
        select: {
          status: true,
        },
      }),

      // Today's task stats
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

      // Five most recent tasks for the activity feed
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

      // Task stats for the last 7 days
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

      // Three most recent notifications
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

    // Agent stats
    const onlineAgents = agents.filter((a) => a.status === "online");
    const activeAgentCount = onlineAgents.length;

    // Device stats
    const totalDevices = devices.length;
    const onlineDevices = devices.filter((d) => d.status === "reachable").length;
    const offlineDevices = totalDevices - onlineDevices;

    // Today's task stats
    const todayTotal = todayTasks.length;
    const todaySuccess = todayTasks.filter((t) => t.status === "success").length;
    const todayFailed = todayTasks.filter((t) => t.status === "failed").length;

    // Task stats for the last 7 days
    const weekTotal = weekTasks.length;
    const weekSuccess = weekTasks.filter((t) => t.status === "success").length;
    const weekRunning = weekTasks.filter((t) => t.status === "running").length;
    const weekFailed = weekTasks.filter((t) => t.status === "failed").length;

    // Calculate system health from the online agent ratio and task success rate
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
