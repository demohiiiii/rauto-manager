"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotificationStore } from "@/lib/store/notification-store";
import type { Notification, NotificationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const LEVEL_STYLES: Record<
  NotificationLevel,
  { bg: string; text: string; icon: string }
> = {
  info: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", icon: "ℹ️" },
  success: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", icon: "✅" },
  warning: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", icon: "⚠️" },
  error: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", icon: "❌" },
};

function formatTime(
  date: Date,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("timeJustNow");
  if (minutes < 60) return t("timeMinutesAgo", { count: minutes });
  if (hours < 24) return t("timeHoursAgo", { count: hours });
  return t("timeDaysAgo", { count: days });
}

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead } = useNotificationStore();
  const tc = useTranslations("common");
  const style = LEVEL_STYLES[notification.level];

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      markAsRead(notification.id);
    } catch (error) {
      console.error("标记已读失败:", error);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50",
        !notification.read && "bg-muted/30"
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style.bg)}>
        <span className="text-sm">{style.icon}</span>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium", style.text)}>
            {notification.title}
          </p>
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleMarkRead}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{notification.message}</p>
        <p className="text-xs text-muted-foreground/60">
          {formatTime(notification.createdAt, tc)}
        </p>
      </div>

      {!notification.read && (
        <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  );
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, setNotifications, setUnreadCount, markAllAsRead } =
    useNotificationStore();
  const t = useTranslations("notifications");
  const tc = useTranslations("common");

  useEffect(() => {
    // 初始加载通知列表
    fetch("/api/notifications?limit=20")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNotifications(data.data);
          setUnreadCount(data.meta.unreadCount);
        }
      })
      .catch((error) => console.error("加载通知失败:", error));
  }, [setNotifications, setUnreadCount]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      markAllAsRead();
    } catch (error) {
      console.error("全部标记已读失败:", error);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:scale-105 transition-transform"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center animate-pulse"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{t("title")}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              {t("markAllRead")}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
