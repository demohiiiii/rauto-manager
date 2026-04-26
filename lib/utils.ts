import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  AgentConnection,
  AgentReportMode,
  ConnectionPayload,
  Device,
} from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAgentReportMode(
  mode?: string | null,
): AgentReportMode {
  return mode === "grpc" ? "grpc" : "http";
}

export function formatAgentReportMode(mode?: string | null): "HTTP" | "gRPC" {
  return normalizeAgentReportMode(mode) === "grpc" ? "gRPC" : "HTTP";
}

export function formatAgentConnectionLabel(
  connection: Pick<
    AgentConnection,
    "name" | "host" | "device_profile" | "default_mode"
  >,
): string {
  const host = connection.host?.trim();
  const profile = connection.device_profile?.trim();
  const defaultMode = connection.default_mode?.trim();
  const summary =
    profile && defaultMode
      ? `${profile} / ${defaultMode}`
      : profile || defaultMode || "";

  return [
    connection.name,
    host ? `(${host})` : null,
    summary ? `[${summary}]` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function getOptionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getOptionalSecretString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function getOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function getOptionalRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getOptionalJsonRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return getOptionalRecord(parsed);
  } catch {
    return undefined;
  }
}

export function buildConnectionPayloadFromInput(
  input?: Record<string, unknown> | Partial<AgentConnection> | null,
  options?: { fallbackConnectionName?: string },
): ConnectionPayload | undefined {
  if (!input) {
    return options?.fallbackConnectionName
      ? { connection_name: options.fallbackConnectionName }
      : undefined;
  }

  const payload: ConnectionPayload = {};

  payload.connection_name =
    getOptionalTrimmedString(
      (input as Record<string, unknown>).connection_name,
    ) ??
    getOptionalTrimmedString((input as Record<string, unknown>).name) ??
    getOptionalTrimmedString(options?.fallbackConnectionName);

  payload.host = getOptionalTrimmedString(
    (input as Record<string, unknown>).host,
  );
  payload.username = getOptionalTrimmedString(
    (input as Record<string, unknown>).username,
  );
  payload.password = getOptionalSecretString(
    (input as Record<string, unknown>).password,
  );
  payload.port = getOptionalPositiveInteger(
    (input as Record<string, unknown>).port,
  );
  payload.enable_password =
    getOptionalSecretString(
      (input as Record<string, unknown>).enable_password,
    ) ??
    getOptionalSecretString((input as Record<string, unknown>).enablePassword);
  payload.enable_password_empty_enter =
    typeof (input as Record<string, unknown>).enable_password_empty_enter ===
    "boolean"
      ? ((input as Record<string, unknown>)
          .enable_password_empty_enter as boolean)
      : typeof (input as Record<string, unknown>).enablePasswordEmptyEnter ===
          "boolean"
        ? ((input as Record<string, unknown>)
            .enablePasswordEmptyEnter as boolean)
        : undefined;
  payload.ssh_security =
    getOptionalTrimmedString((input as Record<string, unknown>).ssh_security) ??
    getOptionalTrimmedString((input as Record<string, unknown>).sshSecurity);
  payload.device_profile =
    getOptionalTrimmedString(
      (input as Record<string, unknown>).device_profile,
    ) ??
    getOptionalTrimmedString((input as Record<string, unknown>).deviceProfile);
  payload.linux_shell_flavor =
    getOptionalTrimmedString(
      (input as Record<string, unknown>).linux_shell_flavor,
    ) ??
    getOptionalTrimmedString(
      (input as Record<string, unknown>).linuxShellFlavor,
    );
  payload.template_dir =
    getOptionalTrimmedString((input as Record<string, unknown>).template_dir) ??
    getOptionalTrimmedString((input as Record<string, unknown>).templateDir);
  payload.enabled =
    typeof (input as Record<string, unknown>).enabled === "boolean"
      ? ((input as Record<string, unknown>).enabled as boolean)
      : undefined;
  payload.labels = getOptionalStringArray(
    (input as Record<string, unknown>).labels,
  );
  payload.groups = getOptionalStringArray(
    (input as Record<string, unknown>).groups,
  );
  payload.vars =
    getOptionalRecord((input as Record<string, unknown>).vars) ??
    getOptionalJsonRecord((input as Record<string, unknown>).vars_json);

  return Object.values(payload).some((value) => value !== undefined)
    ? payload
    : undefined;
}

/**
 * Convert Prisma Agent BigInt fields to Number so they can be JSON-serialized.
 */
export function serializeAgent<T extends { uptimeSeconds: bigint }>(
  agent: T,
): Omit<T, "uptimeSeconds"> & { uptimeSeconds: number } {
  return { ...agent, uptimeSeconds: Number(agent.uptimeSeconds) };
}

/**
 * A device cannot be considered reachable from the manager if its owning agent
 * is not currently available, even when the last probe result was reachable.
 */
export function getEffectiveDeviceStatus(
  deviceStatus: Device["status"] | string,
  agentStatus?: string | null,
): Device["status"] {
  return getEffectiveDeviceState(deviceStatus, agentStatus).status;
}

export function isAgentAvailableStatus(status?: string | null): boolean {
  return status === "online" || status === "busy";
}

export function getEffectiveDeviceState(
  deviceStatus: Device["status"] | string,
  agentStatus?: string | null,
): Pick<Device, "status" | "statusReason"> {
  const normalized =
    deviceStatus === "reachable" ||
    deviceStatus === "unreachable" ||
    deviceStatus === "unknown"
      ? deviceStatus
      : "unknown";

  if (!agentStatus) {
    return { status: normalized };
  }

  if (!isAgentAvailableStatus(agentStatus)) {
    return {
      status: "unreachable",
      statusReason: "agent_offline",
    };
  }

  return { status: normalized };
}
