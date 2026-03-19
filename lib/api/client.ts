import axios, { AxiosInstance, isAxiosError } from "axios";
import type {
  Agent,
  Device,
  Task,
  ApiResponse,
  ExecutionHistoryRecord,
  ExecutionHistoryStats,
  GlobalSearchResults,
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

    // Normalize API error responses: turn backend `{ success: false, error: "..." }`
    // into ordinary return values so callers can branch on `result.success`.
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (isAxiosError(error) && error.response?.data) {
          // If the backend returned a response body, treat it as a normal payload
          return { data: error.response.data };
        }
        // Keep throwing when there is no response body, such as a network failure
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

  async checkAgentHealth(id: string): Promise<
    ApiResponse<{ healthy: boolean; agentStatus?: string; payload?: unknown }>
  > {
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

  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    const { data } = await this.client.delete("/devices", {
      params: { id },
    });
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

  async search(q: string): Promise<ApiResponse<GlobalSearchResults>> {
    const { data } = await this.client.get("/search", { params: { q } });
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
