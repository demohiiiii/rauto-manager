import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";
import { getSystemTranslator } from "@/app/api/utils/i18n";

interface ReportedDevice {
  name: string;
  host: string;
  port?: number;
  device_profile?: string;
}

interface ReportDevicesBody {
  name: string; // agent name
  devices: ReportedDevice[];
}

export async function POST(request: NextRequest) {
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body: ReportDevicesBody = await request.json();
    const t = await getSystemTranslator();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.devices)) {
      return NextResponse.json(
        { success: false, error: t("common.missingRequiredFields") },
        { status: 400 }
      );
    }

    // Look up the agent
    const agent = await prisma.agent.findUnique({
      where: { name: body.name },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: t("notifications.agentNotFound") },
        { status: 404 }
      );
    }

    // Fully sync the device list inside a transaction without changing status
    const syncedDevices = await prisma.$transaction(async (tx) => {
      const existingDevices = await tx.device.findMany({
        where: { agentId: agent.id },
      });

      // Build a set of unique identifiers for reported devices
      const reportedKeys = new Set(
        body.devices.map((d) => `${d.name}:${d.host}`)
      );

      // Remove old devices that are no longer present in the reported list
      const toDelete = existingDevices.filter(
        (d) => !reportedKeys.has(`${d.name}:${d.host}`)
      );
      if (toDelete.length > 0) {
        await tx.device.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        });
      }

      // Upsert reported devices while keeping their current status
      const results = [];
      for (const device of body.devices) {
        const existing = existingDevices.find(
          (d) => d.name === device.name && d.host === device.host
        );

        if (existing) {
          // Update basic device fields while preserving the existing status
          const updated = await tx.device.update({
            where: { id: existing.id },
            data: {
              type: device.device_profile ?? existing.type,
              port: device.port ?? existing.port,
              // Keep status and lastChecked unchanged
            },
          });
          results.push(updated);
        } else {
          // Default new devices to unknown status
          const created = await tx.device.create({
            data: {
              agentId: agent.id,
              name: device.name,
              type: device.device_profile ?? "unknown",
              host: device.host,
              port: device.port,
              status: "unknown",
            },
          });
          results.push(created);
        }
      }

      return results;
    });

    const response: ApiResponse<{ synced: number }> = {
      success: true,
      data: { synced: syncedDevices.length },
    };

    // Notification: device report received
    createNotification({
      type: "device_report",
      title: t("notifications.deviceListSync"),
      message: t("notifications.devicesSynced", { name: body.name, count: syncedDevices.length }),
      level: "info",
      metadata: { agentId: agent.id, agentName: body.name, deviceCount: syncedDevices.length },
    }).catch(() => {});

    return NextResponse.json(response);
  } catch (error) {
    const t = await getSystemTranslator();
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : t("notifications.deviceReportFailed"),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
