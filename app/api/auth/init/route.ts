import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email } = body;

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

    // 检查是否已经初始化过
    const existingAdmin = await prisma.admin.findFirst();
    if (existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "系统已经初始化，无法重复创建管理员账户",
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // 创建管理员账户
    const hashedPassword = await hashPassword(password);
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
      },
    });

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
    console.error("Admin initialization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "初始化管理员账户失败",
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

// 检查是否需要初始化
export async function GET() {
  try {
    const adminCount = await prisma.admin.count();
    return NextResponse.json({
      success: true,
      data: {
        needsInit: adminCount === 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "检查初始化状态失败",
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
