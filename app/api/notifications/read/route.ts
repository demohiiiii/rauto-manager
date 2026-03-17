import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mark all notifications as read
    if (body.all === true) {
      const result = await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });

      return NextResponse.json({
        success: true,
        data: { updated: result.count },
      });
    }

    // Mark a single notification as read
    if (body.id) {
      await prisma.notification.update({
        where: { id: body.id },
        data: { read: true },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "需要提供 id 或 all: true" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "标记已读失败",
      },
      { status: 500 },
    );
  }
}
