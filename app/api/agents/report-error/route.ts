import { NextRequest } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import {
  reportAgentError,
  type AgentErrorReportInput,
} from "@/lib/agent-reporting";
import {
  AGENT_REPORTING_HEADERS,
  agentReportingErrorResponse,
  agentReportingJson,
} from "@/lib/agent-reporting-http";

/**
 * POST /api/agents/report-error
 * Agent error reporting endpoint.
 *
 * Auth: Bearer token or X-API-Key header.
 */
export async function POST(request: NextRequest) {
  if (!validateAgentApiKey(request)) {
    return unauthorizedResponse(AGENT_REPORTING_HEADERS);
  }

  try {
    const body: AgentErrorReportInput = await request.json();
    const result = await reportAgentError(body);

    const response: ApiResponse<{ accepted: boolean; event_id: string }> = {
      success: true,
      data: {
        accepted: true,
        event_id: result.eventId,
      },
    };

    return agentReportingJson(response, { status: 202 });
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
