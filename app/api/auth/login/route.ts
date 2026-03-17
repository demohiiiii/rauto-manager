import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken, setAuthCookie } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 验证必填字段
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "用户名和密码不能为空",
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "用户名或密码错误",
        } as ApiResponse<never>,
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "用户名或密码错误",
        } as ApiResponse<never>,
        { status: 401 }
      );
    }

    // 创建 JWT token
    const token = await createToken({
      adminId: admin.id,
      username: admin.username,
    });

    // 设置 cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
    } as ApiResponse<typeof admin>);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "登录失败",
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
