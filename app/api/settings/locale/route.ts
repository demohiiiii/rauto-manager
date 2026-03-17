import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * GET /api/settings/locale
 * Get the current system locale
 */
export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "system.locale" },
    });

    const locale = config?.value ?? "en";

    return NextResponse.json({
      success: true,
      data: { locale },
    } satisfies ApiResponse<{ locale: string }>);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get locale",
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/locale
 * Update the system locale
 * Body: { locale: "zh" | "en" }
 */
export async function PUT(request: NextRequest) {
  try {
    // Validate admin permissions
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const body = await request.json();
    const { locale } = body;

    // Validate the locale value
    if (!locale || !["zh", "en"].includes(locale)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid locale. Must be 'zh' or 'en'",
        } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    // Update or create the config entry
    await prisma.systemConfig.upsert({
      where: { key: "system.locale" },
      update: { value: locale },
      create: { key: "system.locale", value: locale },
    });

    return NextResponse.json({
      success: true,
      data: { locale },
    } satisfies ApiResponse<{ locale: string }>);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update locale",
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}
