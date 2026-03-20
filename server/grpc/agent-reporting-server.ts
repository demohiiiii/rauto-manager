import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import {
  AgentReportingError,
  registerAgent,
  reportAgentError,
  reportDevices,
  reportTaskExecutionEvent,
  reportTaskCallback,
  sendHeartbeat,
  notifyOffline,
  updateDeviceStatuses,
  type AgentErrorReportInput,
  type ReportDevicesInput,
  type TaskCallbackReportInput,
  type TaskExecutionEventReportInput,
  type UpdateDeviceStatusInput,
} from "@/lib/agent-reporting";
import { validateAgentHeaderValues } from "@/lib/agent-auth-core";
import type {
  AgentHeartbeatInput,
  AgentOfflineInput,
  AgentRegisterInput,
} from "@/lib/types";

interface AckResponse {
  success: boolean;
}

interface RegisterAgentResponse {
  success: boolean;
}

interface ReportDevicesResponse {
  success: boolean;
  synced: number;
}

interface UpdateDeviceStatusResponse {
  success: boolean;
  updated: number;
}

type GrpcRequest =
  | AgentRegisterInput
  | AgentHeartbeatInput
  | AgentOfflineInput
  | ReportDevicesInput
  | UpdateDeviceStatusInput
  | AgentErrorReportInput
  | TaskCallbackReportInput
  | TaskExecutionEventReportInput;

type GrpcResponse =
  | AckResponse
  | RegisterAgentResponse
  | ReportDevicesResponse
  | UpdateDeviceStatusResponse;

const PROTO_PATH = path.join(
  process.cwd(),
  "proto",
  "rauto",
  "manager",
  "v1",
  "agent_reporting.proto"
);

const globalForGrpcServer = globalThis as typeof globalThis & {
  agentReportingGrpcServerPromise?: Promise<grpc.Server>;
  agentReportingGrpcServer?: grpc.Server;
  agentReportingGrpcShutdownHookRegistered?: boolean;
};

const DEFAULT_GRPC_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

function getGrpcPort(): number {
  const raw = process.env.MANAGER_GRPC_PORT?.trim() || "50051";
  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid MANAGER_GRPC_PORT value: ${raw}`);
  }

  return port;
}

function getGrpcHost(): string {
  return process.env.MANAGER_GRPC_HOST?.trim() || "0.0.0.0";
}

function getGrpcMaxMessageBytes(): number {
  const raw =
    process.env.MANAGER_GRPC_MAX_MESSAGE_BYTES?.trim() ||
    String(DEFAULT_GRPC_MAX_MESSAGE_BYTES);
  const size = Number(raw);

  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Invalid MANAGER_GRPC_MAX_MESSAGE_BYTES value: ${raw}`);
  }

  return size;
}

function loadAgentReportingServiceDefinition(): grpc.ServiceDefinition {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: false,
    oneofs: true,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;
  const rautoPackage = grpcObject.rauto as grpc.GrpcObject;
  const managerPackage = rautoPackage.manager as grpc.GrpcObject;
  const versionPackage = managerPackage.v1 as grpc.GrpcObject;
  const service = versionPackage.AgentReportingService as grpc.ServiceClientConstructor;

  return service.service;
}

function firstMetadataValue(metadata: grpc.Metadata, key: string): string | undefined {
  const [value] = metadata.get(key);

  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return undefined;
}

function assertAuthenticated(metadata: grpc.Metadata) {
  const authorization = firstMetadataValue(metadata, "authorization");
  const apiKey = firstMetadataValue(metadata, "x-api-key");

  if (!validateAgentHeaderValues(authorization, apiKey)) {
    throw new AgentReportingError("UNAUTHENTICATED", "Invalid agent API key");
  }
}

function grpcStatusForError(error: unknown): grpc.status {
  if (error instanceof AgentReportingError) {
    switch (error.code) {
      case "UNAUTHENTICATED":
        return grpc.status.UNAUTHENTICATED;
      case "INVALID_ARGUMENT":
        return grpc.status.INVALID_ARGUMENT;
      case "NOT_FOUND":
        return grpc.status.NOT_FOUND;
      case "INTERNAL":
      default:
        return grpc.status.INTERNAL;
    }
  }

  return grpc.status.INTERNAL;
}

function toServiceError(error: unknown): grpc.ServiceError {
  const message =
    error instanceof Error ? error.message : "Agent reporting request failed";

  return {
    name: "AgentReportingServiceError",
    message,
    code: grpcStatusForError(error),
    details: message,
    metadata: new grpc.Metadata(),
  };
}

async function handleUnary<Req extends GrpcRequest, Res extends GrpcResponse>(
  call: grpc.ServerUnaryCall<Req, Res>,
  callback: grpc.sendUnaryData<Res>,
  operation: (request: Req) => Promise<Res>
) {
  try {
    assertAuthenticated(call.metadata);
    const response = await operation(call.request);
    callback(null, response);
  } catch (error) {
    if (!(error instanceof AgentReportingError)) {
      console.error("gRPC agent reporting handler failed:", error);
    }

    callback(toServiceError(error), null);
  }
}

function registerShutdownHooks(server: grpc.Server) {
  if (globalForGrpcServer.agentReportingGrpcShutdownHookRegistered) {
    return;
  }

  const shutdown = () => {
    server.tryShutdown((error) => {
      if (error) {
        console.error("Failed to stop gRPC server cleanly:", error);
        server.forceShutdown();
      }
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  globalForGrpcServer.agentReportingGrpcShutdownHookRegistered = true;
}

function bindServer(server: grpc.Server, host: string, port: number) {
  return new Promise<number>((resolve, reject) => {
    server.bindAsync(
      `${host}:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, boundPort) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(boundPort);
      }
    );
  });
}

async function startAgentReportingGrpcServer() {
  const maxMessageBytes = getGrpcMaxMessageBytes();
  const server = new grpc.Server({
    "grpc.max_receive_message_length": maxMessageBytes,
    "grpc.max_send_message_length": maxMessageBytes,
  });
  const serviceDefinition = loadAgentReportingServiceDefinition();

  server.addService(serviceDefinition, {
    RegisterAgent: (
      call: grpc.ServerUnaryCall<AgentRegisterInput, RegisterAgentResponse>,
      callback: grpc.sendUnaryData<RegisterAgentResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await registerAgent(request);
        return { success: true };
      }),
    SendHeartbeat: (
      call: grpc.ServerUnaryCall<AgentHeartbeatInput, AckResponse>,
      callback: grpc.sendUnaryData<AckResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await sendHeartbeat(request);
        return { success: true };
      }),
    NotifyOffline: (
      call: grpc.ServerUnaryCall<AgentOfflineInput, AckResponse>,
      callback: grpc.sendUnaryData<AckResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await notifyOffline(request);
        return { success: true };
      }),
    ReportDevices: (
      call: grpc.ServerUnaryCall<ReportDevicesInput, ReportDevicesResponse>,
      callback: grpc.sendUnaryData<ReportDevicesResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        const result = await reportDevices(request);
        return { success: true, synced: result.synced };
      }),
    UpdateDeviceStatus: (
      call: grpc.ServerUnaryCall<UpdateDeviceStatusInput, UpdateDeviceStatusResponse>,
      callback: grpc.sendUnaryData<UpdateDeviceStatusResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        const result = await updateDeviceStatuses(request);
        return { success: true, updated: result.updated };
      }),
    ReportError: (
      call: grpc.ServerUnaryCall<AgentErrorReportInput, AckResponse>,
      callback: grpc.sendUnaryData<AckResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await reportAgentError(request);
        return { success: true };
      }),
    ReportTaskCallback: (
      call: grpc.ServerUnaryCall<TaskCallbackReportInput, AckResponse>,
      callback: grpc.sendUnaryData<AckResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await reportTaskCallback(request);
        return { success: true };
      }),
    ReportTaskEvent: (
      call: grpc.ServerUnaryCall<TaskExecutionEventReportInput, AckResponse>,
      callback: grpc.sendUnaryData<AckResponse>
    ) =>
      void handleUnary(call, callback, async (request) => {
        await reportTaskExecutionEvent(request);
        return { success: true };
      }),
  });

  const host = getGrpcHost();
  const port = getGrpcPort();
  const boundPort = await bindServer(server, host, port);
  registerShutdownHooks(server);

  console.info(
    `Agent reporting gRPC server listening on ${host}:${boundPort} (max message ${maxMessageBytes} bytes)`
  );
  return server;
}

export async function ensureAgentReportingGrpcServer() {
  if (globalForGrpcServer.agentReportingGrpcServer) {
    return globalForGrpcServer.agentReportingGrpcServer;
  }

  if (!globalForGrpcServer.agentReportingGrpcServerPromise) {
    globalForGrpcServer.agentReportingGrpcServerPromise =
      startAgentReportingGrpcServer().then((server) => {
        globalForGrpcServer.agentReportingGrpcServer = server;
        return server;
      });
  }

  return globalForGrpcServer.agentReportingGrpcServerPromise;
}
