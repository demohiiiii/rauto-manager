import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * GET /api/settings/locale
 * 获取当前系统语言设置
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
 * 更新系统语言设置
 * Body: { locale: "zh" | "en" }
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证管理员权限
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const body = await request.json();
    const { locale } = body;

    // 验证 locale 值
    if (!locale || !["zh", "en"].includes(locale)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid locale. Must be 'zh' or 'en'",
        } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    // 更新或创建配置
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
