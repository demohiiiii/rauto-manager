"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNotificationStore } from "@/lib/store/notification-store";
import type { Notification, NotificationLevel } from "@/lib/types";

const LEVEL_ICON_MAP: Record<NotificationLevel, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};

export function useNotificationStream() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      // 清理旧连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource("/api/notifications/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[SSE] 通知流已连接");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 跳过连接成功事件
          if (data.type === "connected") {
            return;
          }

          const notification = data as Notification;

          // 更新 store
          addNotification(notification);

          // 显示 toast
          const icon = LEVEL_ICON_MAP[notification.level];
          const message = `${icon} ${notification.title}`;

          switch (notification.level) {
            case "success":
              toast.success(message, { description: notification.message });
              break;
            case "error":
              toast.error(message, { description: notification.message });
              break;
            case "warning":
              toast.warning(message, { description: notification.message });
              break;
            default:
              toast.info(message, { description: notification.message });
          }
        } catch (error) {
          console.error("[SSE] 解析通知失败:", error);
        }
      };

      eventSource.onerror = () => {
        console.error("[SSE] 连接错误，5 秒后重连");
        eventSource.close();

        if (mounted) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [addNotification]);
}
