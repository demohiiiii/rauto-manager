import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";
import { getSystemTranslator } from "@/app/api/utils/i18n";

export async function POST() {
  try {
    await clearAuthCookie();
    const t = await getSystemTranslator();

    return NextResponse.json({
      success: true,
      data: { message: t("nav.logoutSuccess") },
    } as ApiResponse<{ message: string }>);
  } catch (error) {
    console.error("Logout error:", error);
    const t = await getSystemTranslator();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : t("nav.logoutFailed"),
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
