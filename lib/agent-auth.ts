import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

const AGENT_API_KEY = process.env.AGENT_API_KEY;

/**
 * Validate the Agent API key.
 * Supports two authentication mechanisms:
 *   1. Authorization: Bearer <token> (used by rauto agent)
 *   2. X-API-Key: <token>
 * If AGENT_API_KEY is not configured, allow the request for development convenience.
 */
export function validateAgentApiKey(request: NextRequest): boolean {
  if (!AGENT_API_KEY) {
    return true;
  }

  // Check Authorization: Bearer <token> first
  const authHeader = request.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken === AGENT_API_KEY) {
      return true;
    }
  }

  // Fall back to the X-API-Key header
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === AGENT_API_KEY;
}

/**
 * Create a 401 unauthorized response.
 */
export function unauthorizedResponse(): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: "无效的 API Key" },
    { status: 401 }
  );
}
