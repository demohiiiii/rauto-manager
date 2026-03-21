import { NextRequest } from "next/server";
import type { ApiResponse, AgentOfflineInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { notifyOffline } from "@/lib/agent-reporting";
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
    const body: AgentOfflineInput = await request.json();
    await notifyOffline(body, { reportMode: "http" });

    const response: ApiResponse<null> = { success: true };
    return agentReportingJson(response);
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
