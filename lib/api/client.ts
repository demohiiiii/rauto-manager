import axios, { AxiosInstance, isAxiosError } from "axios";
import type {
  Agent,
  Device,
  Task,
  ApiResponse,
  ExecutionHistoryRecord,
  ExecutionHistoryStats,
} from "@/lib/types";

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = "/api") {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 统一处理错误响应：将后端返回的 { success: false, error: "..." } 从 throw 转为正常返回
    // 这样调用方可以统一通过 result.success 判断，而非 try/catch
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (isAxiosError(error) && error.response?.data) {
          // 后端有返回体，将其作为正常响应返回
          return { data: error.response.data };
        }
        // 网络错误等无响应的情况，继续 throw
        throw error;
      }
    );
  }

  // Agent API
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    const { data } = await this.client.get("/agents");
    return data;
  }

  async getAgent(id: string): Promise<ApiResponse<Agent>> {
    const { data } = await this.client.get(`/agents/${id}`);
    return data;
  }

  async createAgent(agent: Partial<Agent>): Promise<ApiResponse<Agent>> {
    const { data } = await this.client.post("/agents", agent);
    return data;
  }

  async updateAgent(
    id: string,
    agent: Partial<Agent>
  ): Promise<ApiResponse<Agent>> {
    const { data } = await this.client.put(`/agents/${id}`, agent);
    return data;
  }

  async deleteAgent(id: string): Promise<ApiResponse<void>> {
    const { data } = await this.client.delete(`/agents/${id}`);
    return data;
  }

  async checkAgentHealth(id: string): Promise<ApiResponse<{ healthy: boolean }>> {
    const { data } = await this.client.get(`/agents/${id}/health`);
    return data;
  }

  // Device API
  async getDevices(): Promise<ApiResponse<Device[]>> {
    const { data } = await this.client.get("/devices");
    return data;
  }

  async getDevice(id: string): Promise<ApiResponse<Device>> {
    const { data } = await this.client.get(`/devices/${id}`);
    return data;
  }

  async getDevicesByAgent(agentId: string): Promise<ApiResponse<Device[]>> {
    const { data } = await this.client.get(`/devices?agentId=${agentId}`);
    return data;
  }

  // Task API
  async getTasks(): Promise<ApiResponse<Task[]>> {
    const { data } = await this.client.get("/tasks");
    return data;
  }

  async getTask(id: string): Promise<ApiResponse<Task>> {
    const { data } = await this.client.get(`/tasks/${id}`);
    return data;
  }

  async createTask(task: Partial<Task>): Promise<ApiResponse<Task>> {
    const { data } = await this.client.post("/tasks", task);
    return data;
  }

  async executeTask(id: string): Promise<ApiResponse<Task>> {
    const { data } = await this.client.post(`/tasks/${id}/execute`);
    return data;
  }

  async cancelTask(id: string): Promise<ApiResponse<Task>> {
    const { data } = await this.client.post(`/tasks/${id}/cancel`);
    return data;
  }

  async getExecutionHistory(filters: {
    search?: string;
    status?: "success" | "failed";
    agentId?: string;
    range?: "all" | "24h" | "7d" | "30d";
    page?: number;
    limit?: number;
  } = {}): Promise<
    ApiResponse<{
      records: ExecutionHistoryRecord[];
      stats: ExecutionHistoryStats;
    }>
  > {
    const { data } = await this.client.get("/history", { params: filters });
    return data;
  }

  // Dispatch API
  async dispatch(body: Record<string, unknown>): Promise<ApiResponse<{ task_id: string; dispatched: boolean; agent_name: string; dispatch_type: string }>> {
    const { data } = await this.client.post("/dispatch", body);
    return data;
  }

  // Agent Connections & Templates
  async getAgentConnections(agentId: string): Promise<ApiResponse<{ connections: Array<{ name: string; host?: string; port?: number; device_profile?: string; has_password?: boolean }> }>> {
    const { data } = await this.client.get(`/agents/${agentId}/connections`);
    return data;
  }

  async getAgentTemplates(agentId: string): Promise<ApiResponse<{ templates: Array<{ name: string; path: string }> }>> {
    const { data } = await this.client.get(`/agents/${agentId}/templates`);
    return data;
  }
}

export const apiClient = new ApiClient();
