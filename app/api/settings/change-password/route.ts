import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hashPassword, verifyPassword } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

/**
 * POST /api/settings/change-password
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentAdmin();
    const t = await getSystemTranslator();

    if (!auth) {
      return NextResponse.json(
        { success: false, error: t("auth.unauthorized") } satisfies ApiResponse<never>,
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: t("auth.provideCurrentAndNewPassword") } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: t("auth.newPasswordMinLength") } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: auth.adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: t("auth.userNotFound") } satisfies ApiResponse<never>,
        { status: 404 }
      );
    }

    const valid = await verifyPassword(currentPassword, admin.password);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: t("auth.currentPasswordIncorrect") } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    const hashed = await hashPassword(newPassword);
    await prisma.admin.update({
      where: { id: auth.adminId },
      data: { password: hashed },
    });

    return NextResponse.json({
      success: true,
      data: { message: t("settings.passwordChanged") },
    });
  } catch (error) {
    const t = await getSystemTranslator();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : t("settings.changePasswordFailed"),
      } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}
