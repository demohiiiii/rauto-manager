import { NextRequest } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import {
  updateDeviceStatuses,
  type UpdateDeviceStatusInput,
} from "@/lib/agent-reporting";
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
    const body: UpdateDeviceStatusInput = await request.json();
    const result = await updateDeviceStatuses(body);

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      data: result,
    };

    return agentReportingJson(response);
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
