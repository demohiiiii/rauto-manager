import { NextRequest } from "next/server";
import type { ApiResponse, AgentHeartbeatInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { sendHeartbeat } from "@/lib/agent-reporting";
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
    const body: AgentHeartbeatInput = await request.json();
    await sendHeartbeat(body, { reportMode: "http" });

    const response: ApiResponse<null> = { success: true };
    return agentReportingJson(response);
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
