#!/usr/bin/env bash
# =============================================================================
# deploy/tencent/init-server.sh
# =============================================================================
# 腾讯云 TencentOS Server 3.3 (CentOS 8 兼容) 首次部署初始化脚本
# 只需在裸机上跑一次（root 权限）
#
# 使用方法：
#   ssh root@49.234.163.103
#   curl -fsSL https://raw.githubusercontent.com/your-org/desktop-tutorial/main/deploy/tencent/init-server.sh | bash
# 或：
#   bash deploy/tencent/init-server.sh
# =============================================================================

set -euo pipefail

echo "=============================="
echo " SummitLink CN 节点初始化脚本"
echo " 腾讯云上海 | TencentOS 3.3"
echo "=============================="

# ---------- 1. 系统更新 ----------
echo ""
echo "▶ 1/7 系统更新..."
yum update -y --quiet

# ---------- 2. 安装 Docker ----------
echo ""
echo "▶ 2/7 安装 Docker..."
if ! command -v docker &> /dev/null; then
  # TencentOS 3.3 使用 dnf / yum，Docker 包名为 docker-ce
  yum install -y yum-utils
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "  ✅ Docker 安装成功：$(docker --version)"
else
  echo "  ✅ Docker 已安装：$(docker --version)"
fi

# docker compose（V2 插件）
if ! docker compose version &> /dev/null; then
  echo "  安装 docker-compose-plugin..."
  yum install -y docker-compose-plugin
fi
echo "  ✅ docker compose：$(docker compose version)"

# ---------- 3. 防火墙配置 ----------
echo ""
echo "▶ 3/7 配置防火墙..."
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port=80/tcp
  firewall-cmd --permanent --add-port=443/tcp
  firewall-cmd --permanent --add-port=8080/tcp
  firewall-cmd --reload
  echo "  ✅ 防火墙已开放 80/443/8080"
else
  echo "  ⚠️  firewalld 未运行，请确保腾讯云安全组已放行 80/443/8080"
fi

# ---------- 4. 创建工作目录 ----------
echo ""
echo "▶ 4/7 创建工作目录..."
mkdir -p /opt/summitlink
mkdir -p /opt/summitlink/data/postgres
mkdir -p /opt/summitlink/uploads
chmod 755 /opt/summitlink
echo "  ✅ /opt/summitlink 创建成功"

# ---------- 5. 安装 fail2ban（防 SSH 爆破）----------
echo ""
echo "▶ 5/7 安装 fail2ban..."
if ! command -v fail2ban-client &> /dev/null; then
  yum install -y epel-release
  yum install -y fail2ban
  systemctl enable --now fail2ban
  echo "  ✅ fail2ban 安装并启动"
else
  echo "  ✅ fail2ban 已安装"
fi

# ---------- 6. 安装 Certbot（SSL 证书）----------
echo ""
echo "▶ 6/7 安装 Certbot（Let's Encrypt）..."
if ! command -v certbot &> /dev/null; then
  yum install -y python3-certbot-nginx || \
    (pip3 install certbot certbot-nginx && ln -sf "$(which certbot)" /usr/local/bin/certbot)
  echo "  ✅ Certbot 安装成功"
else
  echo "  ✅ Certbot 已安装：$(certbot --version 2>&1)"
fi

# ---------- 7. 内核参数优化（适合 4GB 内存）----------
echo ""
echo "▶ 7/7 内核参数优化..."
cat > /etc/sysctl.d/99-summitlink.conf << 'EOF'
# 网络优化（4Mbps 带宽下的连接管理）
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 30

# 内存限制（4GB 机器节省内存）
vm.swappiness = 10
vm.overcommit_memory = 1
EOF
sysctl --system --quiet
echo "  ✅ 内核参数已优化"

# ---------- 完成 ----------
echo ""
echo "=============================="
echo " ✅ 初始化完成！"
echo "=============================="
echo ""
echo "下一步："
echo "  1. 将代码部署到 /opt/summitlink："
echo "     git clone https://github.com/your-org/desktop-tutorial.git /opt/summitlink"
echo "     cd /opt/summitlink && cp deploy/tencent/.env.example .env"
echo "     vim .env  # 填写真实 secrets"
echo ""
echo "  2. 配置 5 个 GitHub Secrets（供 CI/CD 使用）："
echo "     TENCENT_HOST=49.234.163.103"
echo "     TENCENT_SSH_PORT=22"
echo "     TENCENT_SSH_USER=root"
echo "     TENCENT_SSH_KEY=<私钥内容>"
echo "     TENCENT_DEPLOY_PATH=/opt/summitlink"
echo ""
echo "  3. 申请 SSL 证书（ICP 备案完成后）："
echo "     certbot --nginx -d summitlink.app -d www.summitlink.app"
echo ""
echo "  4. 启动服务："
echo "     cd /opt/summitlink && bash deploy/tencent/deploy.sh"
