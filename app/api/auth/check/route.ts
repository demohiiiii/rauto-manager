import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "未登录",
        } as ApiResponse<never>,
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        adminId: admin.adminId,
        username: admin.username,
      },
    } as ApiResponse<typeof admin>);
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "检查认证状态失败",
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
