import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
  AgentReportMode,
  ConnectionPayload,
  DispatchType,
} from "@/lib/types";

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const PROTO_PATH = path.join(
  process.cwd(),
  "proto",
  "rauto",
  "agent",
  "v1",
  "task_service.proto"
);
const DEFAULT_GRPC_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

type GrpcDispatchMethod =
  | "GetAgentInfo"
  | "GetAgentStatus"
  | "ListConnections"
  | "UpsertConnection"
  | "TestConnection"
  | "ListTemplates"
  | "ListDeviceProfiles"
  | "ProbeDevices"
  | "ExecuteCommand"
  | "ExecuteTemplate"
  | "ExecuteTxBlockAsync"
  | "ExecuteTxWorkflowAsync"
  | "ExecuteOrchestrationAsync";

type GrpcRequestPayload = Record<string, unknown>;
type GrpcResponsePayload = Record<string, unknown>;

interface GrpcAgentInfo {
  host: string;
  port: number;
  reportMode?: AgentReportMode;
}

interface GrpcDispatchOptions {
  agent: GrpcAgentInfo;
  type: DispatchType;
  taskId: string;
  connection?: Record<string, unknown>;
  payload: Record<string, unknown>;
  dryRun?: boolean;
  recordLevel?: string;
  timeoutMs: number;
}

const RECORD_LEVEL_MAP: Record<string, string> = {
  Off: "off",
  KeyEventsOnly: "key-events-only",
  Full: "full",
};

const GRPC_METHOD_MAP: Record<DispatchType, GrpcDispatchMethod> = {
  exec: "ExecuteCommand",
  template: "ExecuteTemplate",
  tx_block: "ExecuteTxBlockAsync",
  tx_workflow: "ExecuteTxWorkflowAsync",
  orchestrate: "ExecuteOrchestrationAsync",
};

function getGrpcMaxMessageBytes(): number {
  const raw =
    process.env.AGENT_TASK_GRPC_MAX_MESSAGE_BYTES?.trim() ||
    process.env.AGENT_GRPC_MAX_MESSAGE_BYTES?.trim() ||
    String(DEFAULT_GRPC_MAX_MESSAGE_BYTES);
  const size = Number(raw);

  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Invalid AGENT_TASK_GRPC_MAX_MESSAGE_BYTES value: ${raw}`);
  }

  return size;
}

function loadAgentTaskServiceClientCtor(): grpc.ServiceClientConstructor {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: false,
    oneofs: true,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;
  const rautoPackage = grpcObject.rauto as grpc.GrpcObject;
  const agentPackage = rautoPackage.agent as grpc.GrpcObject;
  const versionPackage = agentPackage.v1 as grpc.GrpcObject;
  const service =
    versionPackage.AgentTaskService as grpc.ServiceClientConstructor;
  return service;
}

function createClient(address: string): grpc.Client {
  const ClientCtor = loadAgentTaskServiceClientCtor();
  const maxMessageBytes = getGrpcMaxMessageBytes();

  return new ClientCtor(address, grpc.ChannelCredentials.createInsecure(), {
    "grpc.max_receive_message_length": maxMessageBytes,
    "grpc.max_send_message_length": maxMessageBytes,
  });
}

function createMetadata(): grpc.Metadata {
  const metadata = new grpc.Metadata();

  if (AGENT_API_KEY?.trim()) {
    metadata.set("authorization", `Bearer ${AGENT_API_KEY.trim()}`);
    metadata.set("x-api-key", AGENT_API_KEY.trim());
  }

  return metadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

function normalizeRecordLevel(recordLevel?: string): string {
  if (!recordLevel) {
    return "";
  }

  return RECORD_LEVEL_MAP[recordLevel] ?? recordLevel;
}

function toOptionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function toOptionalInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  return undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapConnectionRef(
  connection?: Record<string, unknown>
): ConnectionPayload | undefined {
  if (!connection || !isRecord(connection)) {
    return undefined;
  }

  const mapped: ConnectionPayload = {};

  if (typeof connection.connection_name === "string") {
    mapped.connection_name = connection.connection_name;
  }
  if (typeof connection.host === "string") {
    mapped.host = connection.host;
  }
  if (typeof connection.username === "string") {
    mapped.username = connection.username;
  }
  if (typeof connection.password === "string") {
    mapped.password = connection.password;
  }
  if (
    typeof connection.port === "number" &&
    Number.isInteger(connection.port) &&
    connection.port > 0
  ) {
    mapped.port = connection.port;
  }
  if (typeof connection.enable_password === "string") {
    mapped.enable_password = connection.enable_password;
  }
  if (typeof connection.ssh_security === "string") {
    mapped.ssh_security = connection.ssh_security;
  }
  if (typeof connection.device_profile === "string") {
    mapped.device_profile = connection.device_profile;
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function buildGrpcRequest(options: GrpcDispatchOptions): {
  method: GrpcDispatchMethod;
  request: GrpcRequestPayload;
} {
  const { type, taskId, connection, payload, dryRun, recordLevel } = options;
  const connectionRef = mapConnectionRef(connection);
  const normalizedRecordLevel = normalizeRecordLevel(recordLevel);
  const method = GRPC_METHOD_MAP[type];

  switch (type) {
    case "exec":
      return {
        method,
        request: {
          task_id: taskId,
          command: toOptionalString(payload.command),
          mode: toOptionalString(payload.mode),
          ...(connectionRef ? { connection: connectionRef } : {}),
          record_level: normalizedRecordLevel,
        },
      };
    case "template":
      return {
        method,
        request: {
          task_id: taskId,
          template: toOptionalString(payload.template),
          vars_json: stringifyJson(payload.vars ?? null),
          mode: toOptionalString(payload.mode),
          dry_run: dryRun ?? false,
          ...(connectionRef ? { connection: connectionRef } : {}),
          record_level: normalizedRecordLevel,
        },
      };
    case "tx_block":
      return {
        method,
        request: {
          task_id: taskId,
          name: toOptionalString(payload.name),
          template: toOptionalString(payload.template),
          vars_json: stringifyJson(payload.vars ?? null),
          commands: toStringArray(payload.commands),
          rollback_commands: toStringArray(payload.rollback_commands),
          rollback_on_failure:
            typeof payload.rollback_on_failure === "boolean"
              ? payload.rollback_on_failure
              : true,
          ...(toOptionalInteger(payload.rollback_trigger_step_index) !== undefined
            ? {
                rollback_trigger_step_index: toOptionalInteger(
                  payload.rollback_trigger_step_index
                ),
              }
            : {}),
          mode: toOptionalString(payload.mode),
          ...(toOptionalInteger(payload.timeout_secs) !== undefined
            ? { timeout_secs: toOptionalInteger(payload.timeout_secs) }
            : {}),
          resource_rollback_command: toOptionalString(
            payload.resource_rollback_command
          ),
          template_profile: toOptionalString(payload.template_profile),
          dry_run: dryRun ?? false,
          ...(connectionRef ? { connection: connectionRef } : {}),
          record_level: normalizedRecordLevel,
        },
      };
    case "tx_workflow":
      return {
        method,
        request: {
          task_id: taskId,
          workflow_json: stringifyJson(payload.workflow ?? null),
          dry_run: dryRun ?? false,
          ...(connectionRef ? { connection: connectionRef } : {}),
          record_level: normalizedRecordLevel,
        },
      };
    case "orchestrate":
      return {
        method,
        request: {
          task_id: taskId,
          plan_json: stringifyJson(payload.plan ?? null),
          base_dir: toOptionalString(payload.base_dir),
          dry_run: toOptionalBoolean(dryRun),
          record_level: normalizedRecordLevel,
        },
      };
  }
}

function getErrorMessage(error: unknown, method: GrpcDispatchMethod): string {
  if (error && typeof error === "object") {
    const grpcError = error as Partial<grpc.ServiceError>;
    if (typeof grpcError.details === "string" && grpcError.details.trim()) {
      return grpcError.details;
    }
    if (typeof grpcError.message === "string" && grpcError.message.trim()) {
      return grpcError.message;
    }
  }

  return `${method} gRPC request failed`;
}

function callUnaryMethod(
  client: grpc.Client,
  method: GrpcDispatchMethod,
  request: GrpcRequestPayload,
  timeoutMs: number
): Promise<GrpcResponsePayload> {
  const metadata = createMetadata();
  const deadline = new Date(Date.now() + timeoutMs);
  const methodFn = (
    client as grpc.Client & Record<string, unknown>
  )[method] as
    | ((
        req: GrpcRequestPayload,
        md: grpc.Metadata,
        options: grpc.CallOptions,
        callback: (error: grpc.ServiceError | null, response?: unknown) => void
      ) => grpc.ClientUnaryCall)
    | undefined;

  if (typeof methodFn !== "function") {
    client.close();
    throw new Error(`Unsupported gRPC task method: ${method}`);
  }

  return new Promise((resolve, reject) => {
    methodFn.call(client, request, metadata, { deadline }, (error, response) => {
      client.close();

      if (error) {
        reject(new Error(getErrorMessage(error, method)));
        return;
      }

      if (isRecord(response)) {
        resolve(response);
        return;
      }

      resolve({});
    });
  });
}

export async function dispatchTaskOverGrpc(
  options: GrpcDispatchOptions
): Promise<GrpcResponsePayload> {
  const { agent, timeoutMs } = options;
  const address = `${agent.host}:${agent.port}`;
  const client = createClient(address);
  const { method, request } = buildGrpcRequest(options);
  return callUnaryMethod(client, method, request, timeoutMs);
}

export function isGrpcMethodUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /UNIMPLEMENTED|12\b/i.test(error.message);
}

interface GrpcAgentCallOptions {
  agent: GrpcAgentInfo;
  timeoutMs: number;
}

export async function getAgentInfoOverGrpc(
  options: GrpcAgentCallOptions
): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(client, "GetAgentInfo", {}, options.timeoutMs);
}

export async function getAgentStatusOverGrpc(
  options: GrpcAgentCallOptions
): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(client, "GetAgentStatus", {}, options.timeoutMs);
}

export async function listConnectionsOverGrpc(
  options: GrpcAgentCallOptions
): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(client, "ListConnections", {}, options.timeoutMs);
}

export async function upsertConnectionOverGrpc(options: {
  agent: GrpcAgentInfo;
  timeoutMs: number;
  name: string;
  connection: Record<string, unknown>;
  savePassword?: boolean;
}): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(
    client,
    "UpsertConnection",
    {
      name: options.name,
      connection: mapConnectionRef(options.connection),
      save_password: options.savePassword ?? true,
    },
    options.timeoutMs
  );
}

export async function testConnectionOverGrpc(options: {
  agent: GrpcAgentInfo;
  timeoutMs: number;
  connection: Record<string, unknown>;
}): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(
    client,
    "TestConnection",
    {
      connection: mapConnectionRef(options.connection),
    },
    options.timeoutMs
  );
}

export async function listTemplatesOverGrpc(
  options: GrpcAgentCallOptions
): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(client, "ListTemplates", {}, options.timeoutMs);
}

export async function listDeviceProfilesOverGrpc(
  options: GrpcAgentCallOptions
): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(client, "ListDeviceProfiles", {}, options.timeoutMs);
}

export async function probeDevicesOverGrpc(options: {
  agent: GrpcAgentInfo;
  timeoutMs: number;
  timeoutSecs?: number;
  connections: string[];
}): Promise<GrpcResponsePayload> {
  const client = createClient(`${options.agent.host}:${options.agent.port}`);
  return callUnaryMethod(
    client,
    "ProbeDevices",
    {
      connections: options.connections,
      timeout_secs: options.timeoutSecs ?? Math.max(1, Math.ceil(options.timeoutMs / 1000)),
    },
    options.timeoutMs
  );
}
