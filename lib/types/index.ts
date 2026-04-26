// Agent-related types
export type AgentReportMode = "http" | "grpc";

export interface Agent {
  id: string;
  name: string;
  host: string;
  port: number;
  reportMode: AgentReportMode;
  status: "online" | "busy" | "offline" | "error";
  lastHeartbeat: Date;
  capabilities: string[];
  version?: string;
  connectionsCount: number;
  templatesCount: number;
  runningTasksCount: number;
  uptimeSeconds: number | bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentLiveInfo {
  name: string;
  version?: string;
  capabilities: string[];
  uptimeSeconds: number;
  connectionsCount: number;
  templatesCount: number;
  customProfilesCount: number;
  managed: boolean;
  transport: "http" | "grpc";
}

export interface DeviceProfileModes {
  name: string;
  default_mode: string;
  modes: string[];
}

export interface AgentConnection {
  name: string;
  host?: string;
  port?: number;
  username?: string;
  ssh_security?: string;
  device_profile?: string;
  linux_shell_flavor?: string;
  template_dir?: string;
  enable_password_empty_enter?: boolean;
  enabled?: boolean;
  labels?: string[];
  groups?: string[];
  vars?: Record<string, unknown>;
  has_password?: boolean;
  default_mode?: string;
  available_modes?: string[];
}

export interface AgentCreateInput {
  name: string;
  host: string;
  port: number;
  reportMode?: AgentReportMode;
  capabilities?: string[];
}

// Device-related types
export interface Device {
  id: string;
  agentId: string;
  name: string;
  type: string;
  host: string;
  port?: number;
  status: "reachable" | "unreachable" | "unknown";
  statusReason?: "agent_offline";
  lastChecked?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  agent?: {
    id: string;
    name: string;
    status: string;
  };
}

// Task-related types
export type DispatchType =
  | "exec"
  | "template"
  | "tx_block"
  | "tx_workflow"
  | "orchestrate";

export type RecordLevel = "KeyEventsOnly" | "Full";

export interface Task {
  id: string;
  name: string;
  description?: string;
  agentIds: string[];
  deviceIds?: string[];
  template: string;
  variables: Record<string, any>;
  dispatchType: DispatchType;
  payload: Record<string, any>;
  status: "pending" | "queued" | "running" | "success" | "failed" | "cancelled";
  result?: TaskResult;
  resultSummary?: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type TaskExecutionEventLevel = "info" | "success" | "warning" | "error";

export interface TaskExecutionEvent {
  id: string;
  taskId: string;
  agentId?: string | null;
  agentName?: string | null;
  eventType: string;
  level: TaskExecutionEventLevel;
  stage?: string | null;
  message: string;
  progress?: number | null;
  details?: Record<string, any> | string | number | boolean | null;
  createdAt: Date;
}

export interface TaskDetail extends Task {
  executionHistory: ExecutionHistory[];
  executionEvents: TaskExecutionEvent[];
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  summary?: string;
}

export interface TaskCreateInput {
  name: string;
  description?: string;
  agentIds: string[];
  deviceIds?: string[];
  template: string;
  variables?: Record<string, any>;
}

export interface TaskDispatchResponse {
  task_id: string;
  accepted: boolean;
  dispatched: boolean;
  agent_name: string;
  dispatch_type: DispatchType;
  task_status: Task["status"];
  execution_mode: "sync" | "async";
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Execution history
export interface ExecutionHistory {
  id: string;
  taskId: string;
  agentId: string;
  deviceId?: string;
  command: string;
  output: string;
  status: "success" | "failed";
  executionTime: number;
  createdAt: Date;
}

export interface ExecutionHistoryRecord extends ExecutionHistory {
  task?: {
    id: string;
    name: string;
    dispatchType: DispatchType;
  };
  agent?: {
    id: string;
    name: string;
  };
  device?: {
    id: string;
    name: string;
    host: string;
  };
}

export interface ExecutionHistoryStats {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  averageDuration: number;
}

// Global search
export interface SearchAgentResult {
  id: string;
  name: string;
  host: string;
  port: number;
  status: Agent["status"];
  version?: string;
  capabilities: string[];
  lastHeartbeat: Date;
}

export interface SearchDeviceResult {
  id: string;
  name: string;
  type: string;
  host: string;
  port?: number;
  status: Device["status"];
  statusReason?: Device["statusReason"];
  agent?: Device["agent"];
}

export interface SearchTaskResult {
  id: string;
  name: string;
  description?: string;
  dispatchType: DispatchType;
  status: Task["status"];
  createdAt: Date;
  agentCount: number;
}

export interface GlobalSearchResults {
  query: string;
  total: number;
  counts: {
    agents: number;
    devices: number;
    tasks: number;
    history: number;
  };
  agents: SearchAgentResult[];
  devices: SearchDeviceResult[];
  tasks: SearchTaskResult[];
  history: ExecutionHistoryRecord[];
}

// ===== Unified dispatch types =====

// Device connection info sent to the agent
export interface ConnectionPayload {
  connection_name?: string;
  host?: string;
  username?: string;
  password?: string;
  port?: number;
  enable_password?: string;
  ssh_security?: string;
  device_profile?: string;
  linux_shell_flavor?: string;
  template_dir?: string;
  enable_password_empty_enter?: boolean;
  enabled?: boolean;
  labels?: string[];
  groups?: string[];
  vars?: Record<string, unknown>;
}

// Unified dispatch request
export interface DispatchRequest {
  type: DispatchType;
  agent_id: string;
  connection?: ConnectionPayload;
  payload: Record<string, unknown>;
  dry_run?: boolean;
  record_level?: RecordLevel;
}

// ===== Agent communication types =====

// Agent registration request
export interface AgentRegisterInput {
  name: string;
  host: string;
  port: number;
  version?: string;
  capabilities?: string[];
  connections_count?: number;
  templates_count?: number;
}

// Agent heartbeat request
export interface AgentHeartbeatInput {
  name: string;
  status: string;
  running_tasks?: number;
  connections_count?: number;
  templates_count?: number;
  uptime_seconds?: number;
}

// Agent offline request
export interface AgentOfflineInput {
  name: string;
}

// Task callback request
export interface TaskCallbackInput {
  task_id: string;
  agent_name: string;
  status: "success" | "failed" | string;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  result?: unknown;
  result_json?: string | null;
  result_summary_json?: string | null;
  error?: string | null;
}

export interface TaskExecutionEventInput {
  task_id: string;
  agent_name: string;
  event_type: string;
  message: string;
  level?: TaskExecutionEventLevel;
  stage?: string;
  progress?: number;
  details?: unknown;
  details_json?: string | null;
  occurred_at?: string;
}

// ===== Notification system types =====

export type NotificationType =
  | "agent_online"
  | "agent_offline"
  | "agent_timeout"
  | "device_report"
  | "task_dispatched"
  | "task_success"
  | "task_failed";

export type NotificationLevel = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  level: NotificationLevel;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
