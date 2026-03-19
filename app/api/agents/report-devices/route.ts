import { NextRequest } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { reportDevices, type ReportDevicesInput } from "@/lib/agent-reporting";
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
    const body: ReportDevicesInput = await request.json();
    const result = await reportDevices(body);

    const response: ApiResponse<{ synced: number }> = {
      success: true,
      data: result,
    };

    return agentReportingJson(response);
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
