import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

const AGENT_API_KEY = process.env.AGENT_API_KEY;

/**
 * POST /api/agents/report-error
 * Agent error reporting endpoint.
 *
 * Auth: Bearer token or X-API-Key header.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");

    const token = authHeader?.replace("Bearer ", "") || apiKeyHeader;

    if (!token || token !== AGENT_API_KEY) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Unauthorized",
      };
      return NextResponse.json(response, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.category || !body.kind || !body.severity || !body.occurred_at) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Missing required fields: name, category, kind, severity, occurred_at",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate severity
    if (!["warning", "error"].includes(body.severity)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid severity, must be 'warning' or 'error'",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Generate the event ID
    const eventId = `err_${nanoid(16)}`;

    // Persist the report in the AgentErrorReport table
    await prisma.agentErrorReport.create({
      data: {
        eventId,
        agentName: body.name,
        category: body.category,
        kind: body.kind,
        severity: body.severity,
        occurredAt: new Date(body.occurred_at),
        taskId: body.task_id || null,
        operation: body.operation || null,
        targetUrl: body.target_url || null,
        httpMethod: body.http_method || null,
        httpStatus: body.http_status || null,
        retryable: body.retryable ?? null,
        message: body.message || "",
        details: body.details || {},
      },
    });

    const response: ApiResponse<{ accepted: boolean; event_id: string }> = {
      success: true,
      data: {
        accepted: true,
        event_id: eventId,
      },
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error("Agent error report failed:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

