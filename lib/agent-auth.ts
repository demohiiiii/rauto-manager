import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

const AGENT_API_KEY = process.env.AGENT_API_KEY;

/**
 * 验证 Agent API Key
 * 支持两种认证方式：
 *   1. Authorization: Bearer <token>（rauto agent 使用）
 *   2. X-API-Key: <token>
 * 未配置 AGENT_API_KEY 环境变量时放行（开发环境友好）
 */
export function validateAgentApiKey(request: NextRequest): boolean {
  if (!AGENT_API_KEY) {
    return true;
  }

  // 优先检查 Authorization: Bearer <token>
  const authHeader = request.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken === AGENT_API_KEY) {
      return true;
    }
  }

  // 兼容 X-API-Key 头
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === AGENT_API_KEY;
}

/**
 * 创建 401 未授权响应
 */
export function unauthorizedResponse(): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: "无效的 API Key" },
    { status: 401 }
  );
}
