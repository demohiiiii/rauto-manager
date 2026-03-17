import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";

const DEFAULT_TIMEOUT_MS = 120000; // 2 分钟

/**
 * 惰性检测超时 Agent
 * 将超过阈值未发送心跳的 online Agent 标记为 offline
 * 返回受影响的 Agent 数量
 */
export async function markTimedOutAgents(): Promise<number> {
  const timeoutMs = parseInt(
    process.env.AGENT_TIMEOUT || String(DEFAULT_TIMEOUT_MS)
  );
  const threshold = new Date(Date.now() - timeoutMs);

  // 先查出即将被标记为离线的 Agent 名称（用于通知）
  const timedOutAgents = await prisma.agent.findMany({
    where: {
      status: "online",
      lastHeartbeat: { lt: threshold },
    },
    select: { id: true, name: true },
  });

  if (timedOutAgents.length === 0) {
    return 0;
  }

  const result = await prisma.agent.updateMany({
    where: {
      id: { in: timedOutAgents.map((a) => a.id) },
    },
    data: { status: "offline" },
  });

  // 为每个超时 Agent 创建通知
  for (const agent of timedOutAgents) {
    createNotification({
      type: "agent_timeout",
      title: "Agent 心跳超时",
      message: `Agent「${agent.name}」超过 ${Math.round(timeoutMs / 1000)}s 未心跳，已自动标记为离线`,
      level: "error",
      metadata: { agentId: agent.id, agentName: agent.name },
    }).catch(() => {});
  }

  return result.count;
}
