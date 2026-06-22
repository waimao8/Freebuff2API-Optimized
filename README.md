# Freebuff2API

基于 [XxxXTeam/freebuff2api](https://github.com/XxxXTeam/freebuff2api) 二次开发的 **OpenAI 兼容 API 代理服务**，为 [CodeBuff / FreeBuff](https://freebuff.com) 提供完整的 Web 管理面板、多账号轮换、API Key 管理、实时日志与在线测试等生产级功能。

> **感谢** 原始项目 [XxxXTeam/freebuff2api](https://github.com/XxxXTeam/freebuff2api) 提供的优秀基础！本项目在其之上进行了大量扩展与优化，包括独立管理后台、账号自定义命名、代理测试、日志 SSE 流等。

---

## 特性亮点

| 功能 | 说明 |
|------|------|
| **OpenAI 兼容接口** | `/v1/models`、`/v1/chat/completions` 标准格式，下游零适配 |
| **多账号轮换** | 支持多个 CodeBuff Token，逗号分隔，自动轮询避免并发冲突 |
| **Web 管理面板** | 独立 Vue3 单页应用，绿白配色，美观易用 |
| **账号管理** | 添加/编辑/删除/测试账号，支持自定义账号名称，持久化保存 |
| **API Key 管理** | 生成、启用、禁用、删除 API Key，支持自定义标签 |
| **系统设置** | 可视化修改所有 `.env` 参数，实时保存并生效 |
| **代理测试** | 内置代理连通性测试，一键验证 SOCKS/HTTP 代理 |
| **实时日志** | SSE 流式推送服务日志，支持一键连接/断开/清空 |
| **API 测试** | 面板内直接发起 Chat Completion 测试，支持流式/非流式 |
| **游客模式** | 无可用账号时自动降级，保障服务可用性 |

---

## 技术栈

- **主服务**：Python 3.11 + FastAPI + httpx + SSE
- **管理面板**：FastAPI + Vue 3 (CDN) + 纯 CSS + JWT 认证
- **部署方式**：systemd / 直接运行（推荐 systemd）
- **数据持久化**：`.env` + `~/.freebuff2api/` 本地 JSON

---

## 快速开始

### 1. 获取 Token

无需安装 FreeBuff CLI，直接访问公开页面即可获取：

```
https://freebuff.071129.xyz/
```

1. 打开页面，选择 **FreeBuff**
2. 点击「开始认证」，在跳转页面完成授权
3. 回到页面复制展示的 `Bearer token`
4. 将 token 写入 `.env` 的 `FREEBUFF_TOKEN`

多账号用英文逗号分隔：

```dotenv
FREEBUFF_TOKEN=token-a,token-b,token-c
```

### 2. 安装主服务

```bash
# 克隆项目
git clone https://github.com/kele68108/Freebuff2API.git
cd Freebuff2API

# 安装依赖（推荐 uv）
uv sync

# 或 pip
python -m pip install -e .

# 复制配置文件
cp .env.example .env
# 编辑 .env 填入 FREEBUFF_TOKEN
```

### 3. 启动主服务

```bash
# 直接运行
uv run freebuff2api
# 或
python main.py
```

或使用 **systemd**（推荐生产环境）：

```bash
sudo systemctl enable --now freebuff2api
```

### 4. 安装管理面板（可选但强烈推荐）

```bash
chmod +x install-admin.sh
sudo ./install-admin.sh
```

安装完成后，面板默认运行在 `http://0.0.0.0:8003`，首次访问需设置管理员密码。

---

## 配置说明

复制 `.env.example` 为 `.env`，按需修改：

```dotenv
# 上游 Token（必填，多账号用逗号分隔）
FREEBUFF_TOKEN=your-token-here

# 本地 API Key（留空则不校验）
FREEBUFF_API_KEY=sk-xxxx

# 上游地址
FREEBUFF_API_BASE_URL=https://www.codebuff.com

# 广告提供商（默认 gravity,zeroclick）
FREEBUFF_AD_PROVIDERS=gravity,zeroclick

# 请求超时（秒）
FREEBUFF_TIMEOUT=60

# 代理设置
FREEBUFF_PROXY_ENABLED=false
FREEBUFF_PROXY_URL=http://127.0.0.1:7890

# 日志级别
FREEBUFF_DEBUG=false
FREEBUFF_LOG_LEVEL=INFO
FREEBUFF_LOG_BODY_CHARS=2000
FREEBUFF_LOG_COLOR=true

# 服务监听地址
FREEBUFF_HOST=0.0.0.0
FREEBUFF_PORT=8000

# 时区与语言
FREEBUFF_TIMEZONE=Asia/Shanghai
FREEBUFF_LOCALE=zh-CN
FREEBUFF_OS=windows
```

支持 HTTP / SOCKS5 / SOCKS5H 代理：

```dotenv
FREEBUFF_PROXY_URL=http://127.0.0.1:7890
FREEBUFF_PROXY_URL=socks5://127.0.0.1:1080
FREEBUFF_PROXY_URL=socks5h://user:pass@127.0.0.1:1080
```

---

## 内置模型

- `deepseek/deepseek-v4-flash`
- `deepseek/deepseek-v4-pro`
- `moonshotai/kimi-k2.6`
- `minimax/minimax-m2.7`
- `minimax/minimax-m3`
- `google/gemini-2.5-flash-lite`
- `google/gemini-3.1-flash-lite-preview`
- `google/gemini-3.1-pro-preview`
- `mimo/mimo-v2.5`
- `mimo/mimo-v2.5-pro`

---

## 接口调用示例

### 非流式

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-v4-flash",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### 流式

```bash
curl -N http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-v4-flash",
    "messages": [{"role": "user", "content": "写一个 Python 快排"}],
    "stream": true
  }'
```

### 获取模型列表

```bash
curl http://127.0.0.1:8000/v1/models
```

---

## 管理面板功能

| 模块 | 功能 |
|------|------|
| **数据概览** | 服务运行状态、账号数量、在线时长 |
| **账号管理** | 添加/编辑/删除 CodeBuff Token，自定义账号名称，一键测试可用性 |
| **API Key** | 生成/禁用/删除本地 API Key，用于下游调用鉴权 |
| **系统设置** | 可视化配置所有环境变量，代理测试，一键保存 |
| **实时日志** | SSE 实时推送服务日志，支持搜索过滤 |
| **API 测试** | 内置 Chat Completion 测试窗口，支持选择模型、流式输出 |

面板采用 **JWT + bcrypt** 认证，首次访问强制设置密码，无暴露风险。

---

## 调试排错

遇到空返回或上游异常时，开启调试日志：

```dotenv
FREEBUFF_DEBUG=true
FREEBUFF_LOG_LEVEL=DEBUG
FREEBUFF_LOG_BODY_CHARS=0
```

重启服务后查看日志：

```bash
sudo journalctl -u freebuff2api -f
```

或在管理面板的「实时日志」页面直接查看。

---

## 项目结构

```
Freebuff2API/
├── freebuff2api/           # 主服务核心代码
│   ├── app.py              # FastAPI 应用入口
│   ├── codebuff.py         # CodeBuff 上游客户端
│   ├── openai_compat.py    # OpenAI 兼容层
│   ├── config.py           # 配置加载
│   └── ...
├── admin/                  # 管理面板
│   ├── backend/            # FastAPI 后端（config_manager, auth, main）
│   └── frontend/           # Vue3 前端（单文件 HTML + JS + CSS）
├── tests/                  # 单元测试
├── tool/                   # 辅助工具
├── main.py                 # 主服务启动入口
├── .env.example            # 配置示例
├── install-admin.sh        # 面板一键安装脚本
├── freebuff2api.service    # systemd 服务模板
└── README.md
```

---

## 更新日志

### 2026-06-22
- 修复：账号刷新后自定义名称被重置为「账号1/2/3」的 bug
- 新增：账号元数据持久化存储（`~/.freebuff2api/accounts.json`）
- 优化：管理面板 UI 美化与交互细节

---

## 感谢与致谢

- **原始项目**：[XxxXTeam/freebuff2api](https://github.com/XxxXTeam/freebuff2api) — 提供优秀的 CodeBuff API 代理基础
- **上游服务**：[CodeBuff / FreeBuff](https://freebuff.com) — 提供强大的 AI 模型接入能力

本项目在原始代码基础上，进行了**大量功能扩展与工程化改进**，包括管理面板、账号持久化、API Key 体系、代理测试、日志 SSE、游客模式等。如果你喜欢本项目，也请给原始项目点一颗 ⭐！

---

## License

[MIT License](LICENSE)
