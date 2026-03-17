import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";
import { isNotificationEnabled } from "@/lib/settings";
import type { NotificationType, NotificationLevel } from "@/lib/types";
import type { Prisma } from "@prisma/client";

// ===== SSE Broadcaster (global singleton) =====

const globalForEmitter = globalThis as unknown as {
  notificationEmitter: EventEmitter | undefined;
};

export const notificationEmitter =
  globalForEmitter.notificationEmitter ?? new EventEmitter();

// Avoid MaxListenersExceededWarning when multiple SSE clients connect at once
notificationEmitter.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.notificationEmitter = notificationEmitter;
}

// ===== Notification Creation =====

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  level: NotificationLevel;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification by checking config, writing to the database,
 * and broadcasting over SSE. It is designed not to block the main flow;
 * callers can safely handle failures with a silent `.catch()`.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  // Check if this notification type is enabled in SystemConfig
  const enabled = await isNotificationEnabled(params.type);
  if (!enabled) return;

  const notification = await prisma.notification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      level: params.level,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Broadcast to all connected SSE clients
  notificationEmitter.emit("notification", notification);
}
