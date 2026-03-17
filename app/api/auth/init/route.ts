import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "用户名和密码不能为空",
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Check whether the system has already been initialized
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

    // Create the admin account
    const hashedPassword = await hashPassword(password);
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
      },
    });

    // Create the JWT token
    const token = await createToken({
      adminId: admin.id,
      username: admin.username,
    });

    // Set the auth cookie
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

// Check whether the system still needs initialization
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
