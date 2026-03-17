import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/settings/reset-system
 * Wipes all business data: agents, devices, tasks, history, notifications, configs.
 * Keeps admin accounts intact.
 * Body: { confirmation: "RESET" }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    const t = await getSystemTranslator();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: t("auth.unauthorized") } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const { confirmation } = await request.json();

    if (confirmation !== "RESET") {
      return NextResponse.json(
        {
          success: false,
          error: t("settings.resetConfirmationRequired"),
        } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    // Delete in dependency order to avoid FK violations
    await prisma.$transaction([
      prisma.executionHistory.deleteMany({}),
      prisma.notification.deleteMany({}),
      prisma.systemConfig.deleteMany({}),
      prisma.device.deleteMany({}),
      // Disconnect task-agent relations before deleting
      prisma.task.deleteMany({}),
      prisma.agent.deleteMany({}),
    ]);

    return NextResponse.json({
      success: true,
      data: { message: t("settings.systemReset") },
    });
  } catch (error) {
    const t = await getSystemTranslator();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : t("settings.resetSystemFailed"),
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}
