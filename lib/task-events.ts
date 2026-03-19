import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TaskExecutionEventLevel = "info" | "success" | "warning" | "error";

export interface CreateTaskExecutionEventInput {
  taskId: string;
  agentId?: string | null;
  agentName?: string | null;
  eventType: string;
  level?: TaskExecutionEventLevel;
  stage?: string | null;
  message: string;
  progress?: number | null;
  details?: Prisma.InputJsonValue;
  createdAt?: Date;
}

function normalizeProgress(progress?: number | null): number | null {
  if (progress === undefined || progress === null || Number.isNaN(progress)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(progress)));
}

export async function createTaskExecutionEvent(
  input: CreateTaskExecutionEventInput,
) {
  return prisma.taskExecutionEvent.create({
    data: {
      taskId: input.taskId,
      agentId: input.agentId ?? null,
      agentName: input.agentName ?? null,
      eventType: input.eventType,
      level: input.level ?? "info",
      stage: input.stage ?? null,
      message: input.message,
      progress: normalizeProgress(input.progress),
      details: input.details,
      createdAt: input.createdAt,
    },
  });
}

export function normalizeTaskEventDetails(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}
