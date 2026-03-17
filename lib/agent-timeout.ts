import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";

const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Lazily detect timed-out agents.
 * Mark online agents as offline once they have missed heartbeats past the threshold.
 * Return the number of affected agents.
 */
export async function markTimedOutAgents(): Promise<number> {
  const timeoutMs = parseInt(
    process.env.AGENT_TIMEOUT || String(DEFAULT_TIMEOUT_MS)
  );
  const threshold = new Date(Date.now() - timeoutMs);

  // Fetch the soon-to-be-offlined agent names first so notifications can include them
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

  // Create a notification for each timed-out agent
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
