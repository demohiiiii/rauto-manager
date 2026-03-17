import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, AgentOfflineInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

export async function POST(request: NextRequest) {
  // Validate the API key
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: AgentOfflineInput = await request.json();
    const t = await getSystemTranslator();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // Mark the agent as offline and reset runtime metrics
    await prisma.agent.update({
      where: { name: body.name },
      data: {
        status: "offline",
        activeSessions: 0,
        runningTasksCount: 0,
        uptimeSeconds: 0,
      },
    });

    // Notification: agent offline
    createNotification({
      type: "agent_offline",
      title: t("notifications.agentOffline"),
      message: t("notifications.agentDisconnected", { name: body.name }),
      level: "warning",
      metadata: { agentName: body.name },
    }).catch(() => {});

    const response: ApiResponse<null> = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    const t = await getSystemTranslator();
    // Prisma P2025: Record not found
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 }
      );
    }

    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("notifications.offlineNotificationFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
