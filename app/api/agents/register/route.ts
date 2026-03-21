import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, AgentRegisterInput } from "@/lib/types";
import { validateAgentApiKey, unauthorizedResponse } from "@/lib/agent-auth";
import { registerAgent } from "@/lib/agent-reporting";
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
    const body: AgentRegisterInput = await request.json();
    const agent = await registerAgent(body, { reportMode: "http" });

    const response: ApiResponse<{ id: string; name: string; status: string }> =
      {
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
        },
      };

    return agentReportingJson(response, { status: 201 });
  } catch (error) {
    return agentReportingErrorResponse(error);
  }
}
