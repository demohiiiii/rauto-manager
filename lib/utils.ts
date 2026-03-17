import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert Prisma Agent BigInt fields to Number so they can be JSON-serialized.
 */
export function serializeAgent<T extends { uptimeSeconds: bigint }>(
  agent: T
): Omit<T, "uptimeSeconds"> & { uptimeSeconds: number } {
  return { ...agent, uptimeSeconds: Number(agent.uptimeSeconds) };
}
