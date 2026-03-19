import { NextResponse } from "next/server";
import {
  AgentReportingError,
  type AgentReportingErrorCode,
} from "@/lib/agent-reporting";
import type { ApiResponse } from "@/lib/types";

export const AGENT_REPORTING_HEADERS: Record<string, string> = {};

function httpStatusForReportingError(code: AgentReportingErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "INVALID_ARGUMENT":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "INTERNAL":
    default:
      return 500;
  }
}

export function agentReportingJson<T>(
  body: ApiResponse<T>,
  init?: ResponseInit
) {
  const headers = new Headers(init?.headers);
  Object.entries(AGENT_REPORTING_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function agentReportingErrorResponse(error: unknown) {
  if (error instanceof AgentReportingError) {
    return agentReportingJson<never>(
      { success: false, error: error.message },
      { status: httpStatusForReportingError(error.code) }
    );
  }

  return agentReportingJson<never>(
    {
      success: false,
      error: error instanceof Error ? error.message : "Agent reporting failed",
    },
    { status: 500 }
  );
}
