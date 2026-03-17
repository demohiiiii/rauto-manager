// Agent 相关类型
export interface Agent {
  id: string;
  name: string;
  host: string;
  port: number;
  status: "online" | "offline" | "error";
  lastHeartbeat: Date;
  capabilities: string[];
  version?: string;
  connectionsCount: number;
  templatesCount: number;
  activeSessions: number;
  runningTasksCount: number;
  uptimeSeconds: number | bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCreateInput {
  name: string;
  host: string;
  port: number;
  capabilities?: string[];
}

// 设备相关类型
export interface Device {
  id: string;
  agentId: string;
  name: string;
  type: string;
  host: string;
  port?: number;
  status: "reachable" | "unreachable" | "unknown";
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

// 任务相关类型
export type DispatchType =
  | "exec"
  | "template"
  | "tx_block"
  | "tx_workflow"
  | "orchestrate";

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
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  result?: TaskResult;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export interface TaskCreateInput {
  name: string;
  description?: string;
  agentIds: string[];
  deviceIds?: string[];
  template: string;
  variables?: Record<string, any>;
}

// API 响应类型
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

// 执行历史
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

// ===== 统一下发类型 =====

// 设备连接信息（发送给 Agent）
export interface ConnectionPayload {
  connection_name?: string;
  host?: string;
  username?: string;
  password?: string;
  port?: number;
  enable_password?: string;
  device_profile?: string;
  template_dir?: string;
}

// 统一下发请求
export interface DispatchRequest {
  type: DispatchType;
  agent_id: string;
  connection?: ConnectionPayload;
  payload: Record<string, unknown>;
  dry_run?: boolean;
  record_level?: "Off" | "KeyEventsOnly" | "Full";
}

// ===== Agent 通信类型 =====

// Agent 注册请求
export interface AgentRegisterInput {
  name: string;
  host: string;
  port: number;
  version?: string;
  capabilities?: string[];
  connections_count?: number;
  templates_count?: number;
}

// Agent 心跳请求
export interface AgentHeartbeatInput {
  name: string;
  status: string;
  active_sessions?: number;
  running_tasks?: number;
  connections_count?: number;
  templates_count?: number;
  uptime_seconds?: number;
}

// Agent 离线请求
export interface AgentOfflineInput {
  name: string;
}

// 任务回调请求
export interface TaskCallbackInput {
  task_id: string;
  agent_name: string;
  status: "success" | "failed";
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  result?: Record<string, unknown>;
  error?: string;
}

// ===== 通知系统类型 =====

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
