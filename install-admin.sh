#!/usr/bin/env bash
set -e

PROJECT_DIR="/root/freebuff2api"
ADMIN_DIR="${PROJECT_DIR}/admin"
SERVICE_NAME="freebuff2api-admin"

echo "=== Freebuff2API Admin Panel 安装脚本 ==="

# 1. 检查项目目录
if [ ! -d "${PROJECT_DIR}" ]; then
    echo "错误: 未找到 ${PROJECT_DIR}"
    echo "请先将 freebuff2api 项目部署到 ${PROJECT_DIR}"
    exit 1
fi

# 2. 创建 .env（如果不存在）
if [ ! -f "${PROJECT_DIR}/.env" ]; then
    echo "创建默认 .env..."
    cat > "${PROJECT_DIR}/.env" <<'EOF'
FREEBUFF_TOKEN=
FREEBUFF_API_KEY=
FREEBUFF_API_BASE_URL=https://www.codebuff.com
FREEBUFF_AD_PROVIDERS=gravity,zeroclick
FREEBUFF_TIMEOUT=60
FREEBUFF_PROXY_ENABLED=false
FREEBUFF_PROXY_URL=
FREEBUFF_DEBUG=false
FREEBUFF_LOG_LEVEL=INFO
FREEBUFF_LOG_BODY_CHARS=2000
FREEBUFF_LOG_COLOR=true
FREEBUFF_HOST=0.0.0.0
FREEBUFF_PORT=8000
FREEBUFF_TIMEZONE=Asia/Shanghai
FREEBUFF_LOCALE=zh-CN
FREEBUFF_OS=windows
EOF
fi

# 3. 安装 Python 依赖
echo "安装依赖..."
python3 -m venv "${ADMIN_DIR}/venv"
"${ADMIN_DIR}/venv/bin/pip" install --upgrade pip -q
"${ADMIN_DIR}/venv/bin/pip" install -r "${ADMIN_DIR}/backend/requirements.txt" -q

echo "依赖安装完成"

# 4. 安装 systemd 服务
echo "安装 systemd 服务..."
cp "${PROJECT_DIR}/freebuff2api-admin.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

# 5. 启动
echo "启动管理面板..."
systemctl start "${SERVICE_NAME}"

sleep 1
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo "✅ 管理面板已启动: http://<IP>:8003"
    echo "提示: 第一次访问会要求设置密码"
else
    echo "❌ 启动失败，请检查 journalctl -u ${SERVICE_NAME}"
    exit 1
fi

echo "安装完成"
