import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { getAllConfigs, updateConfigs, DEFAULT_CONFIGS } from "@/lib/settings";
import type { ApiResponse } from "@/lib/types";

/**
 * GET /api/settings
 * Returns all configs + current admin info + data statistics.
 */
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "未认证" } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const [configs, adminInfo, stats] = await Promise.all([
      getAllConfigs(),
      prisma.admin.findUnique({
        where: { id: admin.adminId },
        select: { username: true, email: true, createdAt: true },
      }),
      getStats(),
    ]);

    const response: ApiResponse<{
      configs: Record<string, string>;
      admin: typeof adminInfo;
      stats: typeof stats;
    }> = {
      success: true,
      data: { configs, admin: adminInfo, stats },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取设置失败",
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Batch update config values.
 * Body: { configs: Record<string, string> }
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "未认证" } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const body = await request.json();
    const updates: Record<string, string> = body.configs;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { success: false, error: "请提供 configs 对象" } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    // Validate keys against known config keys
    const validKeys = new Set(Object.keys(DEFAULT_CONFIGS));
    const invalidKeys = Object.keys(updates).filter((k) => !validKeys.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `未知配置项: ${invalidKeys.join(", ")}`,
        } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    await updateConfigs(updates);

    const newConfigs = await getAllConfigs();

    return NextResponse.json({
      success: true,
      data: { configs: newConfigs },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "更新设置失败",
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}

async function getStats() {
  const [agents, devices, tasks, history, notifications] = await Promise.all([
    prisma.agent.count(),
    prisma.device.count(),
    prisma.task.count(),
    prisma.executionHistory.count(),
    prisma.notification.count(),
  ]);

  return {
    agents,
    devices,
    tasks,
    history,
    notifications,
    totalRecords: agents + devices + tasks + history + notifications,
  };
}
