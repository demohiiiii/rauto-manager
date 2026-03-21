import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getSystemTranslator } from "@/app/api/utils/i18n";
import { createNotification } from "@/lib/notification";
import { prisma } from "@/lib/prisma";
import type {
  AgentHeartbeatInput,
  AgentOfflineInput,
  AgentRegisterInput,
  AgentReportMode,
  TaskExecutionEventLevel,
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

export interface TaskExecutionEventReportInput {
  task_id: string;
  agent_name: string;
  event_type: string;
  message: string;
  level?: TaskExecutionEventLevel;
  stage?: string;
  progress?: number;
  details?: unknown;
  details_json?: string | null;
  occurred_at?: string;
}

interface AgentReportingTransportOptions {
  reportMode?: AgentReportMode;
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

function parseOptionalProgress(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value)) {
    throw reportingError(
      "INVALID_ARGUMENT",
      "Field progress must be a finite number"
    );
  }

  return Math.min(100, Math.max(0, Math.round(value)));
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function shouldKeepValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function deepMergeJsonObjects(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Prisma.InputJsonValue {
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = merged[key];

    if (isPlainObject(existingValue) && isPlainObject(incomingValue)) {
      merged[key] = deepMergeJsonObjects(existingValue, incomingValue);
      continue;
    }

    if (!shouldKeepValue(incomingValue) && shouldKeepValue(existingValue)) {
      continue;
    }

    merged[key] = incomingValue;
  }

  return JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue;
}

function mergeResultPayload(
  existing: unknown,
  incoming: Prisma.InputJsonValue | undefined
): Prisma.InputJsonValue | undefined {
  if (incoming === undefined) {
    return cloneJsonValue(existing);
  }

  const normalizedExisting = cloneJsonValue(existing);
  if (!isPlainObject(normalizedExisting) || !isPlainObject(incoming)) {
    return incoming;
  }

  return deepMergeJsonObjects(normalizedExisting, incoming);
}

function mergeSerializedResult(existing: string, incoming: string): string {
  if (!existing.trim()) {
    return incoming;
  }

  if (!incoming.trim()) {
    return existing;
  }

  try {
    const existingParsed = JSON.parse(existing) as unknown;
    const incomingParsed = JSON.parse(incoming) as unknown;
    const merged = mergeResultPayload(existingParsed, cloneJsonValue(incomingParsed));
    return serializeResult(merged);
  } catch {
    return incoming;
  }
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

function asJsonObject(
  value: Prisma.InputJsonValue | undefined
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getObjectString(
  value: Record<string, unknown> | null,
  key: string
): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function getObjectNumber(
  value: Record<string, unknown> | null,
  key: string
): number | undefined {
  const candidate = value?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function shouldMarkTaskFailedFromErrorReport(
  input: AgentErrorReportInput,
  details: Prisma.InputJsonValue | undefined
): {
  shouldMarkFailed: boolean;
  startedAt?: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  errorMessage?: string;
} {
  if (!input.task_id?.trim() || input.severity !== "error") {
    return { shouldMarkFailed: false };
  }

  const detailObject = asJsonObject(details);
  const taskStatus = getObjectString(detailObject, "task_status");

  if (taskStatus !== "failed") {
    return { shouldMarkFailed: false };
  }

  const startedAtValue = getObjectString(detailObject, "started_at");
  const completedAtValue = getObjectString(detailObject, "completed_at");
  const executionTimeMs = getObjectNumber(detailObject, "execution_time_ms");

  return {
    shouldMarkFailed: true,
    startedAt: parseOptionalDate(startedAtValue, "details.started_at"),
    completedAt: parseOptionalDate(
      completedAtValue,
      "details.completed_at"
    ),
    executionTimeMs:
      executionTimeMs !== undefined ? Math.max(0, Math.round(executionTimeMs)) : undefined,
    errorMessage: input.message?.trim() || input.kind,
  };
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

function normalizeTerminalEventResult(
  eventType: "completed" | "failed",
  message: string,
  details: Prisma.InputJsonValue | undefined
): Prisma.InputJsonValue {
  const success = eventType === "completed";
  const detailsObject = asJsonObject(details);

  if (detailsObject) {
    return {
      ...detailsObject,
      success,
      ...(success ? {} : { error: message }),
    };
  }

  if (details !== undefined) {
    return {
      success,
      ...(success ? {} : { error: message }),
      result: details,
    };
  }

  return success
    ? { success: true }
    : {
        success: false,
        error: message,
      };
}

async function upsertExecutionHistory(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    agentId: string;
    command: string;
    output: string;
    status: "success" | "failed";
    executionTime: number;
  }
) {
  const existing = await tx.executionHistory.findFirst({
    where: {
      taskId: input.taskId,
      agentId: input.agentId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existing) {
    return tx.executionHistory.update({
      where: { id: existing.id },
      data: {
        command: input.command,
        output: mergeSerializedResult(existing.output, input.output),
        status: input.status,
        executionTime: input.executionTime,
      },
    });
  }

  return tx.executionHistory.create({
    data: input,
  });
}

function normalizeTaskCallbackResult(
  input: TaskCallbackReportInput
): Prisma.InputJsonValue {
  const parsed = parseOptionalJson(input.result_json, "result_json");
  const normalized =
    normalizeInputJsonValue(input.result, "result") ?? parsed;

  if (input.status === "success") {
    return normalized ?? {
      success: true,
    };
  }

  const errorMessage = input.error?.trim() || "Unknown error";
  const normalizedObject = asJsonObject(normalized);

  if (normalizedObject) {
    return {
      ...normalizedObject,
      success: false,
      error: errorMessage,
    };
  }

  if (normalized !== undefined) {
    return {
      success: false,
      error: errorMessage,
      result: normalized,
    };
  }

  return {
    success: false,
    error: errorMessage,
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

export async function registerAgent(
  input: AgentRegisterInput,
  options: AgentReportingTransportOptions = {}
) {
  const name = requireString(input.name, "name");
  const host = requireString(input.host, "host");
  const port = requirePositivePort(input.port, "port");
  const t = await getSystemTranslator();
  const reportMode = options.reportMode ?? "http";

  const agent = await prisma.agent.upsert({
    where: { name },
    update: {
      host,
      port,
      reportMode,
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
      reportMode,
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

export async function sendHeartbeat(
  input: AgentHeartbeatInput,
  options: AgentReportingTransportOptions = {}
): Promise<void> {
  const name = requireString(input.name, "name");
  const reportMode = options.reportMode ?? "http";

  try {
    await prisma.agent.update({
      where: { name },
      data: {
        lastHeartbeat: new Date(),
        reportMode,
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

export async function notifyOffline(
  input: AgentOfflineInput,
  options: AgentReportingTransportOptions = {}
): Promise<void> {
  const name = requireString(input.name, "name");
  const t = await getSystemTranslator();
  const reportMode = options.reportMode ?? "http";

  try {
    await prisma.agent.update({
      where: { name },
      data: {
        reportMode,
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

export async function reportDevices(
  input: ReportDevicesInput
): Promise<{ synced: number }> {
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
): Promise<{ eventId: string; taskMarkedFailed: boolean }> {
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
  const fallbackTaskFailure = shouldMarkTaskFailedFromErrorReport(input, details);
  const t = await getSystemTranslator();

  const eventId = `err_${nanoid(16)}`;

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.agentErrorReport.create({
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

    const taskId = input.task_id?.trim();
    if (!taskId) {
      return { taskMarkedFailed: false, taskName: null as string | null };
    }

    const [task, agent] = await Promise.all([
      tx.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          dispatchType: true,
          template: true,
          payload: true,
        },
      }),
      tx.agent.findUnique({
        where: { name },
        select: { id: true, name: true },
      }),
    ]);

    if (!task) {
      return { taskMarkedFailed: false, taskName: null as string | null };
    }

    await tx.taskExecutionEvent.create({
      data: {
        taskId: task.id,
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? name,
        eventType: "error_reported",
        level: severity as TaskExecutionEventLevel,
        stage: input.operation?.trim() || "report_error",
        message: t("tasks.eventAgentErrorReported", {
          name,
          kind,
          error: input.message?.trim() || kind,
        }),
        details: {
          category,
          kind,
          retryable: input.retryable,
          targetUrl: input.target_url?.trim() || null,
          httpMethod: input.http_method?.trim() || null,
          httpStatus: input.http_status ?? null,
          errorReport: details,
        },
        createdAt: occurredAt,
      },
    });

    if (
      !fallbackTaskFailure.shouldMarkFailed ||
      !["pending", "queued", "running"].includes(task.status)
    ) {
      return { taskMarkedFailed: false, taskName: task.name };
    }

    const failureMessage =
      fallbackTaskFailure.errorMessage ||
      t("tasks.fallbackTaskFailureFromErrorReport");

    await tx.task.update({
      where: { id: task.id },
      data: {
        status: "failed",
        startedAt: task.startedAt ?? fallbackTaskFailure.startedAt,
        completedAt: fallbackTaskFailure.completedAt ?? occurredAt,
        result: {
          success: false,
          error: failureMessage,
        },
      },
    });

    await tx.taskExecutionEvent.create({
      data: {
        taskId: task.id,
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? name,
        eventType: "failed",
        level: "error",
        stage: input.operation?.trim() || "report_error",
        message: t("tasks.eventMarkedFailedFromErrorReport", {
          name,
        }),
        progress: 100,
        details: {
          source: "agent_error_report",
          kind,
          category,
          executionTimeMs: fallbackTaskFailure.executionTimeMs ?? null,
        },
        createdAt: fallbackTaskFailure.completedAt ?? occurredAt,
      },
    });

    return { taskMarkedFailed: true, taskName: task.name };
  });

  if (outcome.taskMarkedFailed && outcome.taskName) {
    createNotification({
      type: "task_failed",
      title: t("notifications.taskFailed"),
      message: t("notifications.taskCompletedFailed", {
        name,
        taskName: outcome.taskName,
        error:
          fallbackTaskFailure.errorMessage ||
          t("tasks.fallbackTaskFailureFromErrorReport"),
      }),
      level: "error",
      metadata: {
        taskId: input.task_id?.trim() || null,
        agentName: name,
        source: "agent_error_report",
        kind,
      },
    }).catch(() => {});
  }

  return { eventId, taskMarkedFailed: outcome.taskMarkedFailed };
}

export async function reportTaskExecutionEvent(
  input: TaskExecutionEventReportInput
): Promise<void> {
  const taskId = requireString(input.task_id, "task_id");
  const agentName = requireString(input.agent_name, "agent_name");
  const eventType = requireString(input.event_type, "event_type");
  const message = requireString(input.message, "message");
  const occurredAt = parseOptionalDate(input.occurred_at, "occurred_at");
  const progress = parseOptionalProgress(input.progress);
  const level = input.level ?? "info";
  const terminalStatus =
    eventType === "completed"
      ? "success"
      : eventType === "failed"
        ? "failed"
        : null;

  if (!["info", "success", "warning", "error"].includes(level)) {
    throw reportingError(
      "INVALID_ARGUMENT",
      "Field level must be one of: info, success, warning, error"
    );
  }

  const details =
    normalizeInputJsonValue(input.details, "details") ??
    parseOptionalJson(input.details_json, "details_json");
  const t = await getSystemTranslator();

  const notification =
    await prisma.$transaction(async (tx): Promise<{
      taskName: string;
      agentId: string;
      dispatchType: string;
      status: "success" | "failed";
    } | null> => {
    const [task, agent] = await Promise.all([
      tx.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          completedAt: true,
          result: true,
          dispatchType: true,
          template: true,
          payload: true,
        },
      }),
      tx.agent.findUnique({
        where: { name: agentName },
        select: { id: true, name: true },
      }),
    ]);

    if (!task) {
      throw reportingError("NOT_FOUND", `Task not found: ${taskId}`);
    }

    if (!agent) {
      throw reportingError("NOT_FOUND", `Agent not found: ${agentName}`);
    }

    if (task.status === "pending" || task.status === "queued") {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "running",
          startedAt: task.startedAt ?? occurredAt ?? new Date(),
        },
      });
    }

    await tx.taskExecutionEvent.create({
      data: {
        taskId,
        agentId: agent.id,
        agentName: agent.name,
        eventType,
        level,
        stage: input.stage?.trim() || null,
        message,
        progress,
        details,
        createdAt: occurredAt,
      },
    });

    const isActiveTask = ["pending", "queued", "running"].includes(task.status);
    const isTerminalEvent = terminalStatus !== null;

    if (!isActiveTask && !isTerminalEvent) {
      return null;
    }

    if (eventType === "completed") {
      const resultData =
        mergeResultPayload(
          task.result,
          normalizeTerminalEventResult("completed", message, details)
        ) ?? { success: true };
      const completedAt = occurredAt ?? task.completedAt ?? new Date();
      const startedAt = task.startedAt ?? occurredAt ?? new Date();
      const executionTime = Math.max(
        0,
        completedAt.getTime() - startedAt.getTime()
      );

      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "success",
          startedAt,
          completedAt,
          result: resultData,
        },
      });

      await upsertExecutionHistory(tx, {
        taskId,
        agentId: agent.id,
        command: summarizeTaskCommand(task),
        output: serializeResult(resultData),
        status: "success",
        executionTime,
      });
      return isActiveTask || task.status !== "success"
        ? {
            taskName: task.name,
            agentId: agent.id,
            dispatchType: task.dispatchType,
            status: "success" as const,
          }
        : null;
    }

    if (eventType === "failed") {
      const resultData =
        mergeResultPayload(
          task.result,
          normalizeTerminalEventResult("failed", message, details)
        ) ?? {
          success: false,
          error: message,
        };
      const completedAt = occurredAt ?? task.completedAt ?? new Date();
      const startedAt = task.startedAt ?? occurredAt ?? new Date();
      const executionTime = Math.max(
        0,
        completedAt.getTime() - startedAt.getTime()
      );

      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "failed",
          startedAt,
          completedAt,
          result: resultData,
        },
      });

      await upsertExecutionHistory(tx, {
        taskId,
        agentId: agent.id,
        command: summarizeTaskCommand(task),
        output: serializeResult(resultData),
        status: "failed",
        executionTime,
      });
      return isActiveTask || task.status !== "failed"
        ? {
            taskName: task.name,
            agentId: agent.id,
            dispatchType: task.dispatchType,
            status: "failed" as const,
          }
        : null;
    }

    return null;
  });

  if (!notification) {
    return;
  }

  createNotification({
    type:
      notification.status === "success" ? "task_success" : "task_failed",
    title:
      notification.status === "success"
        ? t("notifications.taskSuccess")
        : t("notifications.taskFailed"),
    message:
      notification.status === "success"
        ? t("notifications.taskCompletedSuccess", {
            name: agentName,
            taskName: notification.taskName,
          })
        : t("notifications.taskCompletedFailed", {
            name: agentName,
            taskName: notification.taskName,
            error: message,
          }),
    level: notification.status === "success" ? "success" : "error",
    metadata: {
      taskId,
      agentId: notification.agentId,
      agentName,
      status: notification.status,
      dispatchType: notification.dispatchType,
      source: "task_event",
    },
  }).catch(() => {});
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

    const mergedResultData = mergeResultPayload(task.result, resultData) ?? resultData;
    const shouldNotify =
      ["pending", "queued", "running"].includes(task.status) || task.status !== status;

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        startedAt,
        completedAt: completedAt ?? new Date(),
        result: mergedResultData,
      },
    });

    await upsertExecutionHistory(tx, {
      taskId,
      agentId: agent.id,
      command: summarizeTaskCommand(task),
      output: serializeResult(mergedResultData),
      status: status as "success" | "failed",
      executionTime: input.execution_time_ms ?? 0,
    });

    await tx.taskExecutionEvent.create({
      data: {
        taskId,
        agentId: agent.id,
        agentName,
        eventType: status === "success" ? "completed" : "failed",
        level: status === "success" ? "success" : "error",
        stage: "callback",
        message:
          status === "success"
            ? t("notifications.taskCompletedSuccess", {
                name: agentName,
                taskName: updated.name,
              })
            : t("notifications.taskCompletedFailed", {
                name: agentName,
                taskName: updated.name,
                error: input.error?.trim() || "Unknown error",
              }),
        progress: status === "success" ? 100 : undefined,
        details: normalizeInputJsonValue(mergedResultData, "result"),
        createdAt: completedAt ?? new Date(),
      },
    });

    return { task: updated, agent, shouldNotify };
  });

  if (!updatedTask.shouldNotify) {
    return;
  }

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
