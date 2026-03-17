# Rauto Manager 架构设计

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   Rauto Manager                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │           前端 (Next.js + React)                 │   │
│  │  ├─ Agent 管理界面                               │   │
│  │  ├─ 设备管理界面                                 │   │
│  │  ├─ 任务编排界面                                 │   │
│  │  └─ 实时监控面板                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │         后端 API (Next.js API Routes)            │   │
│  │  ├─ Agent 管理 API                               │   │
│  │  ├─ 设备管理 API                                 │   │
│  │  ├─ 任务管理 API                                 │   │
│  │  └─ WebSocket 服务                               │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │              数据层                               │   │
│  │  ├─ PostgreSQL (持久化存储)                      │   │
│  │  ├─ Redis (任务队列 + 缓存)                      │   │
│  │  └─ Prisma ORM                                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                  Agent 层 (rauto 实例)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Agent 1     │  │  Agent 2     │  │  Agent N     │  │
│  │  (rauto)     │  │  (rauto)     │  │  (rauto)     │  │
│  │              │  │              │  │              │  │
│  │  设备组 A    │  │  设备组 B    │  │  设备组 N    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Agent 管理模块

**职责：**
- Agent 注册与注销
- 健康检查与心跳监控
- Agent 状态管理
- Agent 能力发现

**关键接口：**
```typescript
interface AgentManager {
  registerAgent(agent: AgentCreateInput): Promise<Agent>
  unregisterAgent(id: string): Promise<void>
  checkHealth(id: string): Promise<HealthStatus>
  updateHeartbeat(id: string): Promise<void>
}
```

### 2. 设备管理模块

**职责：**
- 设备清单聚合
- 设备状态同步
- 设备分组与标签
- 设备连接测试

**关键接口：**
```typescript
interface DeviceManager {
  syncDevices(agentId: string): Promise<Device[]>
  checkConnectivity(deviceId: string): Promise<boolean>
  groupDevices(criteria: GroupCriteria): Promise<DeviceGroup[]>
}
```

### 3. 任务编排模块

**职责：**
- 任务创建与调度
- 多 Agent 协调执行
- 任务状态跟踪
- 执行结果收集

**关键接口：**
```typescript
interface TaskOrchestrator {
  createTask(task: TaskCreateInput): Promise<Task>
  executeTask(taskId: string): Promise<TaskResult>
  cancelTask(taskId: string): Promise<void>
  scheduleTask(taskId: string, cron: string): Promise<void>
}
```

### 4. 通信模块

**职责：**
- Agent 与管理平台通信
- 实时状态推送
- 命令下发与结果回传

**通信方式：**
- HTTP REST API (命令下发)
- WebSocket (实时状态)
- gRPC (高性能场景，可选)

## 数据流

### Agent 注册流程

```
1. rauto Agent 启动
2. 向管理平台发送注册请求 (POST /api/agents)
3. 管理平台验证并存储 Agent 信息
4. 返回 Agent ID 和配置
5. Agent 开始定期发送心跳 (POST /api/agents/:id/heartbeat)
```

### 任务执行流程

```
1. 用户在管理平台创建任务
2. 管理平台验证任务参数
3. 任务进入队列 (Redis)
4. 任务调度器分配任务到目标 Agent
5. 向 Agent 发送执行请求 (POST http://agent:port/api/execute)
6. Agent 执行命令并返回结果
7. 管理平台更新任务状态
8. 通过 WebSocket 推送实时状态到前端
```

## 安全设计

### 1. 认证与授权

- Agent 注册需要 API Key
- 用户登录使用 JWT
- RBAC 权限控制

### 2. 通信安全

- HTTPS/TLS 加密
- Agent 与管理平台双向认证 (mTLS)
- 敏感数据加密存储

### 3. 审计日志

- 所有操作记录审计日志
- 命令执行历史完整保存
- 支持日志导出与分析

## 扩展性设计

### 1. 水平扩展

- 管理平台支持多实例部署
- 使用 Redis 共享状态
- 数据库读写分离

### 2. Agent 动态发现

- 支持 Agent 自动注册
- 服务发现机制 (Consul/etcd)
- 负载均衡

### 3. 插件系统

- 自定义设备类型
- 自定义命令模板
- 自定义工作流节点

## 监控与告警

### 1. 指标监控

- Agent 在线率
- 任务成功率
- 命令执行耗时
- 系统资源使用

### 2. 告警规则

- Agent 离线告警
- 任务失败告警
- 设备不可达告警
- 系统异常告警

### 3. 集成方案

- Prometheus + Grafana
- ELK Stack
- 钉钉/企业微信通知

## 部署方案

### 1. Docker Compose (开发/测试)

```yaml
services:
  rauto-manager:
    image: rauto-manager:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...

  postgres:
    image: postgres:16

  redis:
    image: redis:7
```

### 2. Kubernetes (生产)

- 管理平台 Deployment
- PostgreSQL StatefulSet
- Redis Cluster
- Ingress 配置

## 性能优化

### 1. 前端优化

- 代码分割与懒加载
- 图片优化与 CDN
- 缓存策略

### 2. 后端优化

- 数据库索引优化
- Redis 缓存热点数据
- API 响应压缩

### 3. 任务调度优化

- 任务优先级队列
- 并发控制
- 失败重试机制

## 未来规划

- [ ] AI 辅助任务编排
- [ ] 可视化工作流编辑器
- [ ] 多租户支持
- [ ] 国际化 (i18n)
- [ ] 移动端适配
