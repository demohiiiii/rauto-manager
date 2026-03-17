import { prisma } from "@/lib/prisma";

/**
 * SystemConfig default values
 * These are used when a key doesn't exist in the database yet.
 */
export const DEFAULT_CONFIGS: Record<string, string> = {
  "system.name": "Rauto Manager",
  "agent.heartbeat_interval": "30000",
  "agent.timeout": "120000",
  "notification.agent_online": "true",
  "notification.agent_offline": "true",
  "notification.agent_timeout": "true",
  "notification.device_report": "true",
  "notification.task_dispatched": "true",
  "notification.task_success": "true",
  "notification.task_failed": "true",
};

/**
 * Get all configs, merging DB values with defaults.
 */
export async function getAllConfigs(): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany();
  const dbConfigs: Record<string, string> = {};
  for (const row of rows) {
    dbConfigs[row.key] = row.value;
  }
  return { ...DEFAULT_CONFIGS, ...dbConfigs };
}

/**
 * Get a single config value by key.
 */
export async function getConfig(key: string): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_CONFIGS[key] ?? "";
}

/**
 * Check if a notification type is enabled.
 */
export async function isNotificationEnabled(
  type: string
): Promise<boolean> {
  const key = `notification.${type}`;
  const value = await getConfig(key);
  return value !== "false";
}

/**
 * Batch upsert config values.
 */
export async function updateConfigs(
  updates: Record<string, string>
): Promise<void> {
  const operations = Object.entries(updates).map(([key, value]) =>
    prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );
  await prisma.$transaction(operations);
}
