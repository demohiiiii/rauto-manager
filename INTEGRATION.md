# Rauto Agent 集成指南

本文档说明如何将 rauto Agent 与 Rauto Manager 管理平台集成。

## 1. rauto Agent 端改造

### 1.1 添加 HTTP API 接口

在 rauto 项目的 `src/web/handlers.rs` 中添加以下接口：

```rust
use axum::{Json, extract::Path};
use serde::{Deserialize, Serialize};

// Agent 信息结构
#[derive(Serialize)]
pub struct AgentInfo {
    pub id: String,
    pub version: String,
    pub capabilities: Vec<String>,
    pub devices: Vec<DeviceInfo>,
}

#[derive(Serialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub host: String,
    pub status: String,
}

// 命令执行请求
#[derive(Deserialize)]
pub struct ExecuteRequest {
    pub device_id: String,
    pub command: String,
    pub template: Option<String>,
    pub variables: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct ExecuteResponse {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub execution_time: u64,
}

// GET /api/agent/info - 获取 Agent 信息
pub async fn get_agent_info() -> Json<AgentInfo> {
    Json(AgentInfo {
        id: "agent-1".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        capabilities: vec!["ssh".to_string(), "telnet".to_string()],
        devices: vec![],
    })
}

// POST /api/agent/execute - 执行命令
pub async fn execute_command(
    Json(req): Json<ExecuteRequest>
) -> Json<ExecuteResponse> {
    // TODO: 实现命令执行逻辑
    Json(ExecuteResponse {
        success: true,
        output: Some("Command executed".to_string()),
        error: None,
        execution_time: 100,
    })
}

// GET /api/agent/health - 健康检查
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "healthy": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// GET /api/agent/devices - 获取设备列表
pub async fn get_devices() -> Json<Vec<DeviceInfo>> {
    // TODO: 从配置中读取设备列表
    Json(vec![])
}
```

### 1.2 注册路由

在 `src/web/mod.rs` 中注册新的路由：

```rust
use axum::{
    routing::{get, post},
    Router,
};

pub fn create_router() -> Router {
    Router::new()
        // 现有路由...

        // Agent API 路由
        .route("/api/agent/info", get(handlers::get_agent_info))
        .route("/api/agent/execute", post(handlers::execute_command))
        .route("/api/agent/health", get(handlers::health_check))
        .route("/api/agent/devices", get(handlers::get_devices))
}
```

### 1.3 启动 rauto Agent

```bash
cd /home/adam-work/Project/rauto
cargo build --release

# 启动 Agent (监听 8080 端口)
./target/release/rauto web --port 8080
```

## 2. 注册 Agent 到管理平台

### 2.1 使用 API 注册

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent-1",
    "host": "localhost",
    "port": 8080,
    "capabilities": ["ssh", "telnet"],
    "version": "0.2.2"
  }'
```

### 2.2 使用管理平台 UI 注册

1. 访问 http://localhost:3000/agents
2. 点击"注册 Agent"按钮
3. 填写 Agent 信息
4. 提交注册

## 3. 验证集成

### 3.1 健康检查

```bash
# 检查 Agent 是否在线
curl http://localhost:3000/api/agents/{agent-id}/health
```

### 3.2 获取设备列表

```bash
# 获取 Agent 管理的设备
curl http://localhost:8080/api/agent/devices
```

### 3.3 执行命令

```bash
# 通过管理平台执行命令
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试任务",
    "agentIds": ["{agent-id}"],
    "template": "show version",
    "variables": {}
  }'
```

## 4. 心跳机制

### 4.1 Agent 端实现

在 rauto Agent 中添加定时心跳任务：

```rust
use tokio::time::{interval, Duration};

async fn start_heartbeat(manager_url: String, agent_id: String) {
    let mut interval = interval(Duration::from_secs(30));

    loop {
        interval.tick().await;

        let client = reqwest::Client::new();
        let _ = client
            .post(format!("{}/api/agents/{}/heartbeat", manager_url, agent_id))
            .send()
            .await;
    }
}
```

### 4.2 管理平台端实现

在管理平台添加心跳接收接口：

```typescript
// app/api/agents/[id]/heartbeat/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 更新 Agent 最后心跳时间
  // 更新 Agent 状态为 online
  return NextResponse.json({ success: true });
}
```

## 5. 故障处理

### 5.1 Agent 离线检测

管理平台定期检查 Agent 心跳：

```typescript
// 如果超过 60 秒未收到心跳，标记为 offline
const HEARTBEAT_TIMEOUT = 60000;

setInterval(() => {
  agents.forEach(agent => {
    const timeSinceLastHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      agent.status = 'offline';
    }
  });
}, 30000);
```

### 5.2 自动重连

Agent 端实现自动重连逻辑：

```rust
async fn register_with_retry(manager_url: String, max_retries: u32) {
    let mut retries = 0;

    loop {
        match register_agent(&manager_url).await {
            Ok(_) => break,
            Err(e) => {
                retries += 1;
                if retries >= max_retries {
                    panic!("Failed to register after {} retries", max_retries);
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
```

## 6. 安全配置

### 6.1 API Key 认证

在 Agent 注册时使用 API Key：

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{...}'
```

### 6.2 HTTPS 配置

生产环境建议使用 HTTPS：

```rust
// rauto Agent 配置 TLS
use axum_server::tls_rustls::RustlsConfig;

let config = RustlsConfig::from_pem_file(
    "cert.pem",
    "key.pem"
).await?;

axum_server::bind_rustls("0.0.0.0:8443".parse()?, config)
    .serve(app.into_make_service())
    .await?;
```

## 7. 监控与日志

### 7.1 Agent 日志

rauto Agent 输出结构化日志：

```rust
use tracing::{info, error};

info!(
    agent_id = %agent_id,
    command = %command,
    "Executing command"
);
```

### 7.2 管理平台监控

在管理平台查看 Agent 状态和执行历史：

- 访问 http://localhost:3000/agents
- 查看 Agent 详情页
- 查看执行历史记录

## 8. 常见问题

### Q1: Agent 无法连接到管理平台

**解决方案：**
- 检查网络连接
- 确认管理平台地址和端口正确
- 检查防火墙规则

### Q2: 命令执行失败

**解决方案：**
- 检查设备连接配置
- 验证命令模板语法
- 查看 Agent 日志

### Q3: Agent 频繁离线

**解决方案：**
- 增加心跳超时时间
- 检查网络稳定性
- 优化 Agent 资源使用

## 9. 下一步

- [ ] 实现 WebSocket 实时通信
- [ ] 添加任务调度功能
- [ ] 实现工作流编排
- [ ] 集成监控告警系统
