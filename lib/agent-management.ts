import { prisma } from "@/lib/prisma";

export class AgentManagementError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AgentManagementError";
  }
}

export async function deleteOfflineAgentById(id: string) {
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: {
          devices: true,
        },
      },
    },
  });

  if (!agent) {
    throw new AgentManagementError("Agent 不存在", 404);
  }

  if (agent.status !== "offline") {
    throw new AgentManagementError("仅支持删除离线 Agent", 400);
  }

  const result = await prisma.agent.deleteMany({
    where: {
      id,
      status: "offline",
    },
  });

  if (result.count !== 1) {
    throw new AgentManagementError("Agent 状态已变化，请刷新后重试", 409);
  }

  return {
    id: agent.id,
    name: agent.name,
    deletedDevices: agent._count.devices,
  };
}
