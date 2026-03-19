import { NextRequest } from "next/server";
import type { ApiResponse, TaskCallbackInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { reportTaskCallback } from "@/lib/agent-reporting";
import {
  AGENT_REPORTING_HEADERS,
  agentReportingErrorResponse,
  agentReportingJson,
} from "@/lib/agent-reporting-http";

export async function POST(request: NextRequest) {
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse(AGENT_REPORTING_HEADERS);
  }

  try {
    const body: TaskCallbackInput = await request.json();
    await reportTaskCallback(body);

    const response: ApiResponse<null> = { success: true };
    return agentReportingJson(response);
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
