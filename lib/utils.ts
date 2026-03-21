import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { AgentReportMode, Device } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeAgentReportMode(
  mode?: string | null
): AgentReportMode {
  return mode === "grpc" ? "grpc" : "http";
}

export function formatAgentReportMode(mode?: string | null): "HTTP" | "gRPC" {
  return normalizeAgentReportMode(mode) === "grpc" ? "gRPC" : "HTTP";
}

/**
 * Convert Prisma Agent BigInt fields to Number so they can be JSON-serialized.
 */
export function serializeAgent<T extends { uptimeSeconds: bigint }>(
  agent: T
): Omit<T, "uptimeSeconds"> & { uptimeSeconds: number } {
  return { ...agent, uptimeSeconds: Number(agent.uptimeSeconds) };
}

/**
 * A device cannot be considered reachable from the manager if its owning agent
 * is not currently available, even when the last probe result was reachable.
 */
export function getEffectiveDeviceStatus(
  deviceStatus: Device["status"] | string,
  agentStatus?: string | null
): Device["status"] {
  return getEffectiveDeviceState(deviceStatus, agentStatus).status;
}

export function isAgentAvailableStatus(status?: string | null): boolean {
  return status === "online" || status === "busy";
}

export function getEffectiveDeviceState(
  deviceStatus: Device["status"] | string,
  agentStatus?: string | null
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
