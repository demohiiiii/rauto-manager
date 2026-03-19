import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import { createNotification } from "@/lib/notification";
import { prisma } from "@/lib/prisma";
import type {
  AgentHeartbeatInput,
  AgentOfflineInput,
  AgentRegisterInput,
} from "@/lib/types";

export type AgentReportingErrorCode =
  | "INVALID_ARGUMENT"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "INTERNAL";

export class AgentReportingError extends Error {
  constructor(
    public readonly code: AgentReportingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AgentReportingError";
  }
}

export interface ReportedInventoryDeviceInput {
  name: string;
  host: string;
  port?: number;
  device_profile?: string;
}

export interface ReportDevicesInput {
  name: string;
  devices: ReportedInventoryDeviceInput[];
}

export interface ReportedDeviceStatusInput {
  name: string;
  host: string;
  reachable: boolean;
}

export interface UpdateDeviceStatusInput {
  name: string;
  devices: ReportedDeviceStatusInput[];
}

export interface AgentErrorReportInput {
  name: string;
  category: string;
  kind: string;
  severity: string;
  occurred_at: string;
  task_id?: string | null;
  operation?: string | null;
  target_url?: string | null;
  http_method?: string | null;
  http_status?: number | null;
  retryable?: boolean | null;
  message?: string;
  details?: unknown;
  details_json?: string | null;
}

export interface TaskCallbackReportInput {
  task_id: string;
  agent_name: string;
  status: "success" | "failed" | string;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  result?: unknown;
  result_json?: string | null;
  error?: string | null;
}

function reportingError(
  code: AgentReportingErrorCode,
  message: string
): AgentReportingError {
  return new AgentReportingError(code, message);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw reportingError("INVALID_ARGUMENT", `Missing required field: ${field}`);
  }

  return value.trim();
}

function requirePositivePort(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw reportingError(
      "INVALID_ARGUMENT",
      `Field ${field} must be a positive integer`
    );
  }

  return value;
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw reportingError(
      "INVALID_ARGUMENT",
      `Field ${field} must be a valid ISO date string`
    );
  }

  return date;
}

function parseOptionalJson(
  json: string | null | undefined,
  field: string
): Prisma.InputJsonValue | undefined {
  if (!json?.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(json) as Prisma.InputJsonValue;
  } catch {
    throw reportingError(
      "INVALID_ARGUMENT",
      `Field ${field} must contain valid JSON`
    );
  }
}

function toOptionalPort(value: number | undefined): number | null {
  if (!value || value <= 0) {
    return null;
  }

  return value;
}

function serializeResult(value: Prisma.InputJsonValue | undefined): string {
  if (value === undefined) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalizeInputJsonValue(
  value: unknown,
  field: string
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    throw reportingError(
      "INVALID_ARGUMENT",
      `Field ${field} must be JSON-serializable`
    );
  }
}

function summarizeTaskCommand(task: {
  dispatchType: string;
  template: string;
  payload: Prisma.JsonValue;
}): string {
  const payload =
    task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
      ? (task.payload as Record<string, unknown>)
      : {};

  switch (task.dispatchType) {
    case "exec":
      return String(payload.command ?? "task:exec");
    case "template":
      return String(payload.template ?? task.template ?? "task:template");
    case "tx_block":
      return String(payload.name ?? "task:tx_block");
    case "tx_workflow":
      return String(payload.workflow ?? "task:tx_workflow");
    case "orchestrate":
      return String(payload.plan ?? "task:orchestrate");
    default:
      return `task:${task.dispatchType}`;
  }
}

function normalizeTaskCallbackResult(
  input: TaskCallbackReportInput
): Prisma.InputJsonValue {
  if (input.status === "success") {
    const parsed = parseOptionalJson(input.result_json, "result_json");
    return normalizeInputJsonValue(input.result, "result") ?? parsed ?? {
      success: true,
    };
  }

  return {
    success: false,
    error: input.error?.trim() || "Unknown error",
  };
}

async function findAgentByNameOrThrow(name: string) {
  const agent = await prisma.agent.findUnique({
    where: { name },
  });

  if (!agent) {
    throw reportingError("NOT_FOUND", `Agent not found: ${name}`);
  }

  return agent;
}

function handlePrismaNotFound(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw reportingError("NOT_FOUND", message);
  }

  throw error;
}

export async function registerAgent(input: AgentRegisterInput) {
  const name = requireString(input.name, "name");
  const host = requireString(input.host, "host");
  const port = requirePositivePort(input.port, "port");
  const t = await getSystemTranslator();

  const agent = await prisma.agent.upsert({
    where: { name },
    update: {
      host,
      port,
      status: "online",
      lastHeartbeat: new Date(),
      version: input.version?.trim() || null,
      capabilities: input.capabilities ?? [],
      connectionsCount: input.connections_count ?? 0,
      templatesCount: input.templates_count ?? 0,
      activeSessions: 0,
      runningTasksCount: 0,
      uptimeSeconds: BigInt(0),
    },
    create: {
      name,
      host,
      port,
      status: "online",
      lastHeartbeat: new Date(),
      version: input.version?.trim() || null,
      capabilities: input.capabilities ?? [],
      connectionsCount: input.connections_count ?? 0,
      templatesCount: input.templates_count ?? 0,
    },
  });

  createNotification({
    type: "agent_online",
    title: t("notifications.agentOnline"),
    message: t("notifications.agentConnected", {
      name: agent.name,
      host: agent.host,
      port: agent.port,
    }),
    level: "info",
    metadata: { agentId: agent.id, agentName: agent.name },
  }).catch(() => {});

  return {
    id: agent.id,
    name: agent.name,
    status: agent.status,
  };
}

export async function sendHeartbeat(input: AgentHeartbeatInput): Promise<void> {
  const name = requireString(input.name, "name");

  try {
    await prisma.agent.update({
      where: { name },
      data: {
        lastHeartbeat: new Date(),
        status: input.status?.trim() || "online",
        activeSessions: input.active_sessions ?? undefined,
        runningTasksCount: input.running_tasks ?? undefined,
        connectionsCount: input.connections_count ?? undefined,
        templatesCount: input.templates_count ?? undefined,
        uptimeSeconds:
          input.uptime_seconds !== undefined
            ? BigInt(input.uptime_seconds)
            : undefined,
      },
    });
  } catch (error) {
    handlePrismaNotFound(error, `Agent not found: ${name}`);
  }
}

export async function notifyOffline(input: AgentOfflineInput): Promise<void> {
  const name = requireString(input.name, "name");
  const t = await getSystemTranslator();

  try {
    await prisma.agent.update({
      where: { name },
      data: {
        status: "offline",
        activeSessions: 0,
        runningTasksCount: 0,
        uptimeSeconds: BigInt(0),
      },
    });
  } catch (error) {
    handlePrismaNotFound(error, `Agent not found: ${name}`);
  }

  createNotification({
    type: "agent_offline",
    title: t("notifications.agentOffline"),
    message: t("notifications.agentDisconnected", { name }),
    level: "warning",
    metadata: { agentName: name },
  }).catch(() => {});
}

export async function reportDevices(input: ReportDevicesInput): Promise<{ synced: number }> {
  const name = requireString(input.name, "name");
  if (!Array.isArray(input.devices)) {
    throw reportingError("INVALID_ARGUMENT", "Field devices must be an array");
  }

  const agent = await findAgentByNameOrThrow(name);
  const t = await getSystemTranslator();

  const syncedDevices = await prisma.$transaction(async (tx) => {
    const existingDevices = await tx.device.findMany({
      where: { agentId: agent.id },
    });

    const reportedKeys = new Set(
      input.devices.map((device) => {
        const deviceName = requireString(device.name, "devices[].name");
        const host = requireString(device.host, "devices[].host");
        return `${deviceName}:${host}`;
      })
    );

    const toDelete = existingDevices.filter(
      (device) => !reportedKeys.has(`${device.name}:${device.host}`)
    );

    if (toDelete.length > 0) {
      await tx.device.deleteMany({
        where: { id: { in: toDelete.map((device) => device.id) } },
      });
    }

    const results = [];
    for (const device of input.devices) {
      const deviceName = requireString(device.name, "devices[].name");
      const host = requireString(device.host, "devices[].host");
      const existing = existingDevices.find(
        (item) => item.name === deviceName && item.host === host
      );

      if (existing) {
        results.push(
          await tx.device.update({
            where: { id: existing.id },
            data: {
              type: device.device_profile?.trim() || existing.type,
              port: toOptionalPort(device.port) ?? existing.port,
            },
          })
        );
        continue;
      }

      results.push(
        await tx.device.create({
          data: {
            agentId: agent.id,
            name: deviceName,
            type: device.device_profile?.trim() || "unknown",
            host,
            port: toOptionalPort(device.port),
            status: "unknown",
          },
        })
      );
    }

    return results;
  });

  createNotification({
    type: "device_report",
    title: t("notifications.deviceListSync"),
    message: t("notifications.devicesSynced", {
      name,
      count: syncedDevices.length,
    }),
    level: "info",
    metadata: {
      agentId: agent.id,
      agentName: agent.name,
      deviceCount: syncedDevices.length,
    },
  }).catch(() => {});

  return { synced: syncedDevices.length };
}

export async function updateDeviceStatuses(
  input: UpdateDeviceStatusInput
): Promise<{ updated: number }> {
  const name = requireString(input.name, "name");
  if (!Array.isArray(input.devices)) {
    throw reportingError("INVALID_ARGUMENT", "Field devices must be an array");
  }

  const agent = await findAgentByNameOrThrow(name);

  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;

    for (const device of input.devices) {
      const deviceName = requireString(device.name, "devices[].name");
      const host = requireString(device.host, "devices[].host");

      const result = await tx.device.updateMany({
        where: {
          agentId: agent.id,
          name: deviceName,
          host,
        },
        data: {
          status: device.reachable ? "reachable" : "unreachable",
          lastChecked: new Date(),
        },
      });

      count += result.count;
    }

    return count;
  });

  return { updated };
}

export async function reportAgentError(
  input: AgentErrorReportInput
): Promise<{ eventId: string }> {
  const name = requireString(input.name, "name");
  const category = requireString(input.category, "category");
  const kind = requireString(input.kind, "kind");
  const severity = requireString(input.severity, "severity");
  const occurredAt = parseOptionalDate(input.occurred_at, "occurred_at");

  if (!occurredAt) {
    throw reportingError("INVALID_ARGUMENT", "Missing required field: occurred_at");
  }

  if (!["warning", "error"].includes(severity)) {
    throw reportingError(
      "INVALID_ARGUMENT",
      "Field severity must be either 'warning' or 'error'"
    );
  }

  const details =
    normalizeInputJsonValue(input.details, "details") ??
    parseOptionalJson(input.details_json, "details_json") ??
    {};

  const eventId = `err_${nanoid(16)}`;

  await prisma.agentErrorReport.create({
    data: {
      eventId,
      agentName: name,
      category,
      kind,
      severity,
      occurredAt,
      taskId: input.task_id?.trim() || null,
      operation: input.operation?.trim() || null,
      targetUrl: input.target_url?.trim() || null,
      httpMethod: input.http_method?.trim() || null,
      httpStatus: input.http_status ?? null,
      retryable: input.retryable ?? null,
      message: input.message?.trim() || "",
      details,
    },
  });

  return { eventId };
}

export async function reportTaskCallback(
  input: TaskCallbackReportInput
): Promise<void> {
  const taskId = requireString(input.task_id, "task_id");
  const agentName = requireString(input.agent_name, "agent_name");
  const status = requireString(input.status, "status");

  if (!["success", "failed"].includes(status)) {
    throw reportingError(
      "INVALID_ARGUMENT",
      "Field status must be either 'success' or 'failed'"
    );
  }

  const startedAt = parseOptionalDate(input.started_at, "started_at");
  const completedAt = parseOptionalDate(input.completed_at, "completed_at");
  const resultData = normalizeTaskCallbackResult(input);
  const t = await getSystemTranslator();

  const updatedTask = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({
      where: { name: agentName },
    });

    if (!agent) {
      throw reportingError("NOT_FOUND", `Agent not found: ${agentName}`);
    }

    const task = await tx.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw reportingError("NOT_FOUND", `Task not found: ${taskId}`);
    }

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        startedAt,
        completedAt: completedAt ?? new Date(),
        result: resultData,
      },
    });

    await tx.executionHistory.create({
      data: {
        taskId,
        agentId: agent.id,
        command: summarizeTaskCommand(task),
        output:
          status === "success"
            ? serializeResult(resultData)
            : input.error?.trim() || "Unknown error",
        status,
        executionTime: input.execution_time_ms ?? 0,
      },
    });

    return { task: updated, agent };
  });

  createNotification({
    type: status === "success" ? "task_success" : "task_failed",
    title:
      status === "success"
        ? t("notifications.taskSuccess")
        : t("notifications.taskFailed"),
    message:
      status === "success"
        ? t("notifications.taskCompletedSuccess", {
            name: agentName,
            taskName: updatedTask.task.name,
          })
        : t("notifications.taskCompletedFailed", {
            name: agentName,
            taskName: updatedTask.task.name,
            error: input.error?.trim() || "Unknown error",
          }),
    level: status === "success" ? "success" : "error",
    metadata: {
      taskId,
      agentId: updatedTask.agent.id,
      agentName,
      status,
    },
  }).catch(() => {});
}
