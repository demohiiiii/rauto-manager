// Settings page types, constants, and API helpers

// ─── Types ──────────────────────────────────────────────────────────────
export interface SettingsData {
  configs: Record<string, string>;
  admin: {
    username: string;
    email: string | null;
    createdAt: string;
  } | null;
  stats: {
    agents: number;
    devices: number;
    tasks: number;
    history: number;
    notifications: number;
    totalRecords: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────
export const NOTIFICATION_ITEMS = [
  {
    key: "notification.agent_online",
    labelKey: "agentOnlineNotification",
    descriptionKey: "agentOnlineDescription",
  },
  {
    key: "notification.agent_offline",
    labelKey: "agentOfflineAlert",
    descriptionKey: "agentOfflineDescription",
  },
  {
    key: "notification.agent_timeout",
    labelKey: "agentTimeoutAlert",
    descriptionKey: "agentTimeoutAlertDescription",
  },
  {
    key: "notification.device_report",
    labelKey: "deviceReportNotification",
    descriptionKey: "deviceReportDescription",
  },
  {
    key: "notification.task_dispatched",
    labelKey: "taskDispatchedNotification",
    descriptionKey: "taskDispatchedDescription",
  },
  {
    key: "notification.task_success",
    labelKey: "taskSuccessNotification",
    descriptionKey: "taskSuccessDescription",
  },
  {
    key: "notification.task_failed",
    labelKey: "taskFailedAlert",
    descriptionKey: "taskFailedDescription",
  },
] as const;

export const COLOR_THEMES = [
  { name: "zinc", labelKey: "colorZinc", color: "#71717a" },
  { name: "blue", labelKey: "colorBlue", color: "#3b82f6" },
  { name: "green", labelKey: "colorGreen", color: "#22c55e" },
  { name: "purple", labelKey: "colorPurple", color: "#a855f7" },
  { name: "orange", labelKey: "colorOrange", color: "#f97316" },
  { name: "rose", labelKey: "colorRose", color: "#f43f5e" },
];

export const THEME_MODES = [
  { name: "light", labelKey: "lightMode", icon: "Sun" as const },
  { name: "dark", labelKey: "darkMode", icon: "Moon" as const },
  { name: "system", labelKey: "systemMode", icon: "Laptop" as const },
];

// ─── API helpers (with HTTP status checks) ──────────────────────────────
async function handleResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok) {
    // Try parsing JSON error body; fall back to HTTP status text
    try {
      const json = await res.json();
      throw new Error(json.error ?? fallbackMsg);
    } catch (e) {
      if (e instanceof Error && e.message !== fallbackMsg) throw e;
      throw new Error(`${fallbackMsg} (HTTP ${res.status})`);
    }
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? fallbackMsg);
  return json.data as T;
}

export async function fetchSettings(): Promise<SettingsData> {
  const res = await fetch("/api/settings");
  return handleResponse<SettingsData>(res, "Failed to fetch settings");
}

export async function updateConfigs(
  configs: Record<string, string>
): Promise<{ configs: Record<string, string> }> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configs }),
  });
  return handleResponse(res, "Failed to update settings");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await fetch("/api/settings/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return handleResponse(res, "Failed to change password");
}

export async function clearHistory(): Promise<{ deleted: number; message: string }> {
  const res = await fetch("/api/settings/clear-history", { method: "POST" });
  return handleResponse(res, "Failed to clear history");
}

export async function clearNotifications(): Promise<{ deleted: number; message: string }> {
  const res = await fetch("/api/settings/clear-notifications", { method: "POST" });
  return handleResponse(res, "Failed to clear notifications");
}

export async function resetSystem(
  confirmation: string
): Promise<{ message: string }> {
  const res = await fetch("/api/settings/reset-system", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
  return handleResponse(res, "Failed to reset system");
}
