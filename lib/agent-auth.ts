import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { validateAgentHeaderValues } from "@/lib/agent-auth-core";

/**
 * Validate the Agent API key.
 * Supports two authentication mechanisms:
 *   1. Authorization: Bearer <token> (used by rauto agent)
 *   2. X-API-Key: <token>
 * If AGENT_API_KEY is not configured, allow the request for development convenience.
 */
export function validateAgentApiKey(request: NextRequest): boolean {
  return validateAgentHeaderValues(
    request.headers.get("Authorization"),
    request.headers.get("X-API-Key")
  );
}

/**
 * Create a 401 unauthorized response.
 */
export function unauthorizedResponse(
  headers?: HeadersInit
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: "无效的 API Key" },
    { status: 401, headers }
  );
}
