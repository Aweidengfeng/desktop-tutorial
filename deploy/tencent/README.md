# 腾讯云手动部署说明（上海服务器）

## 前置要求
- Ubuntu 20.04 / 22.04
- Docker（`docker`）
- Docker Compose（`docker-compose` 或 `docker compose`）
- Git（`git`）

## 一行部署命令
在仓库根目录执行：

```bash
bash deploy/tencent/manual-deploy.sh
```

脚本会自动完成：
1. 检查依赖
2. `git pull origin main`
3. 自动创建 `.env`（当不存在时）
4. 提示补全必要环境变量
5. 启动 `docker-compose.cn.yml`
6. 轮询健康检查（最多 60 秒）
7. 输出访问地址

## 环境变量说明
可先复制模板：

```bash
cp deploy/tencent/env.template .env
```

| 变量名 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | 主数据库连接串 |
| `DATABASE_URL_CN` | 是 | 中国区数据库连接串（`docker-compose.cn.yml` 使用） |
| `JWT_SECRET` | 是 | JWT 密钥（强随机字符串） |
| `ADMIN_PASSWORD` | 是 | 管理员密码 |
| `COS_BUCKET` | 否 | 腾讯云 COS Bucket |
| `COS_REGION` | 否 | COS 区域，默认 `ap-shanghai` |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | 否 | COS 访问凭据 |
| `PAYMENT_PROVIDER` | 否 | 支付提供方，默认 `wechat` |

## 常见问题排查

### 1) 提示缺少 docker / docker-compose / git
先安装依赖后重试：

```bash
sudo apt update
sudo apt install -y git curl
# Docker / Compose 请按官方文档安装
```

### 2) 健康检查 60 秒超时
脚本会自动打印 `docker-compose` 日志。可继续执行：

```bash
docker-compose -f docker-compose.cn.yml ps
docker-compose -f docker-compose.cn.yml logs --tail=200
```

### 3) `.env` 一直提示必填项未配置
确认变量不是占位值（如 `CHANGEME`、`your_*`、`example*`），保存后重新执行：

```bash
bash deploy/tencent/manual-deploy.sh
```
