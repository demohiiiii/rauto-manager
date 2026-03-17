import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将 Prisma Agent 对象的 BigInt 字段转换为 Number，使其可被 JSON 序列化
 */
export function serializeAgent<T extends { uptimeSeconds: bigint }>(
  agent: T
): Omit<T, "uptimeSeconds"> & { uptimeSeconds: number } {
  return { ...agent, uptimeSeconds: Number(agent.uptimeSeconds) };
}
