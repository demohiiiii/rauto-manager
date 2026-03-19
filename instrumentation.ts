export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (
    process.env.MANAGER_GRPC_ENABLED !== "true" ||
    process.env.MANAGER_GRPC_DISABLED === "true" ||
    process.env.VERCEL === "1"
  ) {
    return;
  }

  const { ensureAgentReportingGrpcServer } = await import(
    "@/server/grpc/agent-reporting-server"
  );

  await ensureAgentReportingGrpcServer();
}
