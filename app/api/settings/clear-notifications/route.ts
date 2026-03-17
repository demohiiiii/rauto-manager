import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/settings/clear-notifications
 * Deletes all Notification records.
 */
export async function POST() {
  try {
    const admin = await getCurrentAdmin();
    const t = await getSystemTranslator();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: t("auth.unauthorized") } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const { count } = await prisma.notification.deleteMany({});

    return NextResponse.json({
      success: true,
      data: { deleted: count, message: t("settings.notificationsCleared", { count: count.toString() }) },
    });
  } catch (error) {
    const t = await getSystemTranslator();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : t("settings.clearNotificationsFailed"),
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}
