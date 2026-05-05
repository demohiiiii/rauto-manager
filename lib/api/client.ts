import axios, { AxiosInstance, isAxiosError } from "axios";
import type {
  Agent,
  AgentConnection,
  AgentTemplateDetail,
  AgentTemplateKind,
  AgentTemplateMeta,
  AgentLiveInfo,
  DeviceProfileModes,
  Device,
  Task,
  TaskDetail,
  TaskDispatchResponse,
  ApiResponse,
  ExecutionHistoryRecord,
  ExecutionHistoryStats,
  GlobalSearchResults,
  ManagerTemplate,
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
      },
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
    agent: Partial<Agent>,
  ): Promise<ApiResponse<Agent>> {
    const { data } = await this.client.put(`/agents/${id}`, agent);
    return data;
  }

  async deleteAgent(id: string): Promise<ApiResponse<void>> {
    const { data } = await this.client.delete(`/agents/${id}`);
    return data;
  }

  async checkAgentHealth(id: string): Promise<
    ApiResponse<{
      healthy: boolean;
      agentStatus?: string;
      payload?: unknown;
      transport?: "http" | "grpc";
    }>
  > {
    const { data } = await this.client.get(`/agents/${id}/health`);
    return data;
  }

  async getAgentInfo(id: string): Promise<ApiResponse<AgentLiveInfo>> {
    const { data } = await this.client.get(`/agents/${id}/info`);
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

  async getTask(id: string): Promise<ApiResponse<TaskDetail>> {
    const { data } = await this.client.get(`/tasks/${id}`);
    return data;
  }

  async createTask(task: Partial<Task>): Promise<ApiResponse<Task>> {
    const { data } = await this.client.post("/tasks", task);
    return data;
  }

  async executeTask(id: string): Promise<ApiResponse<TaskDispatchResponse>> {
    const { data } = await this.client.post(`/tasks/${id}/execute`);
    return data;
  }

  async cancelTask(id: string): Promise<ApiResponse<Task>> {
    const { data } = await this.client.post(`/tasks/${id}/cancel`);
    return data;
  }

  async getExecutionHistory(
    filters: {
      search?: string;
      status?: "success" | "failed";
      agentId?: string;
      range?: "all" | "24h" | "7d" | "30d";
      page?: number;
      limit?: number;
    } = {},
  ): Promise<
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
  async dispatch(
    body: Record<string, unknown>,
  ): Promise<ApiResponse<TaskDispatchResponse>> {
    const { data } = await this.client.post("/dispatch", body);
    return data;
  }

  // Agent Connections & Templates
  async getAgentConnections(
    agentId: string,
  ): Promise<ApiResponse<{ connections: AgentConnection[] }>> {
    const { data } = await this.client.get(`/agents/${agentId}/connections`);
    return data;
  }

  async getAgentTemplates(
    agentId: string,
    kind: AgentTemplateKind = "template",
  ): Promise<ApiResponse<{ templates: AgentTemplateMeta[] }>> {
    const { data } = await this.client.get(`/agents/${agentId}/templates`, {
      params: { kind },
    });
    return data;
  }

  async getAgentTemplate(
    agentId: string,
    kind: AgentTemplateKind,
    name: string,
  ): Promise<ApiResponse<{ template: AgentTemplateDetail }>> {
    const { data } = await this.client.get(
      `/agents/${agentId}/templates/${encodeURIComponent(name)}`,
      { params: { kind } },
    );
    return data;
  }

  async createAgentTemplate(
    agentId: string,
    kind: AgentTemplateKind,
    input: { name: string; content: string },
  ): Promise<ApiResponse<{ template: AgentTemplateDetail }>> {
    const { data } = await this.client.post(
      `/agents/${agentId}/templates`,
      input,
      {
        params: { kind },
      },
    );
    return data;
  }

  async getManagerTemplates(
    kind?: AgentTemplateKind,
  ): Promise<ApiResponse<{ templates: ManagerTemplate[] }>> {
    const { data } = await this.client.get("/templates", {
      params: { kind },
    });
    return data;
  }

  async saveManagerTemplate(input: {
    kind: AgentTemplateKind;
    name: string;
    content: string;
  }): Promise<ApiResponse<{ template: ManagerTemplate }>> {
    const { data } = await this.client.post("/templates", input);
    return data;
  }

  async syncTemplatesFromAgent(input: {
    agentId: string;
    kind: AgentTemplateKind;
    names?: string[];
  }): Promise<ApiResponse<{ templates: ManagerTemplate[]; count: number }>> {
    const { data } = await this.client.post(
      "/templates/sync-from-agent",
      input,
    );
    return data;
  }

  async pushManagerTemplateToAgent(
    templateId: string,
    agentId: string,
  ): Promise<ApiResponse<{ template: AgentTemplateDetail }>> {
    const { data } = await this.client.post(`/templates/${templateId}/push`, {
      agentId,
    });
    return data;
  }

  async getAgentDeviceProfileModes(
    agentId: string,
    profile: string,
  ): Promise<ApiResponse<DeviceProfileModes>> {
    const { data } = await this.client.get(
      `/agents/${agentId}/device-profiles/${encodeURIComponent(profile)}/modes`,
    );
    return data;
  }
}

export const apiClient = new ApiClient();
