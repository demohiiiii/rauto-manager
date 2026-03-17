import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, AgentRegisterInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

export async function POST(request: NextRequest) {
  // Validate the API key
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: AgentRegisterInput = await request.json();
    const t = await getSystemTranslator();

    // Validate required fields
    if (!body.name || !body.host || !body.port) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // Upsert: mark repeat registrations online and create records for new agents
    const agent = await prisma.agent.upsert({
      where: { name: body.name },
      update: {
        host: body.host,
        port: body.port,
        status: "online",
        lastHeartbeat: new Date(),
        version: body.version ?? undefined,
        capabilities: body.capabilities ?? undefined,
        connectionsCount: body.connections_count ?? 0,
        templatesCount: body.templates_count ?? 0,
        // Reset runtime metrics when the agent registers
        activeSessions: 0,
        runningTasksCount: 0,
        uptimeSeconds: 0,
      },
      create: {
        name: body.name,
        host: body.host,
        port: body.port,
        status: "online",
        lastHeartbeat: new Date(),
        version: body.version,
        capabilities: body.capabilities ?? [],
        connectionsCount: body.connections_count ?? 0,
        templatesCount: body.templates_count ?? 0,
      },
    });

    const response: ApiResponse<{ id: string; name: string; status: string }> =
      {
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
        },
      };

    // Notification: agent online
    createNotification({
      type: "agent_online",
      title: t("notifications.agentOnline"),
      message: t("notifications.agentConnected", {
        name: agent.name,
        host: agent.host,
        port: agent.port
      }),
      level: "info",
      metadata: { agentId: agent.id, agentName: agent.name },
    }).catch(() => {});

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const t = await getSystemTranslator();
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("notifications.agentRegisterFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
