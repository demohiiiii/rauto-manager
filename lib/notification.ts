import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";
import { isNotificationEnabled } from "@/lib/settings";
import type { NotificationType, NotificationLevel } from "@/lib/types";
import type { Prisma } from "@prisma/client";

// ===== SSE 广播器（全局单例） =====

const globalForEmitter = globalThis as unknown as {
  notificationEmitter: EventEmitter | undefined;
};

export const notificationEmitter =
  globalForEmitter.notificationEmitter ?? new EventEmitter();

// 避免 MaxListenersExceededWarning（多个 SSE 客户端同时连接）
notificationEmitter.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.notificationEmitter = notificationEmitter;
}

// ===== 通知创建 =====

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  level: NotificationLevel;
  metadata?: Record<string, unknown>;
}

/**
 * 创建通知：检查配置开关 → 写入数据库 → SSE 广播
 * 设计为不阻塞主流程，调用方使用 .catch() 静默处理失败
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

  // 广播给所有 SSE 客户端
  notificationEmitter.emit("notification", notification);
}
