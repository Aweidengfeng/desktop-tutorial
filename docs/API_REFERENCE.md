# API Reference

## Swagger UI

后端启动后可通过以下地址访问 API 文档：

- Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI JSON: `http://localhost:8080/api/docs.json`

> 默认仅在非生产环境开放。生产环境如需开启，请设置 `ENABLE_API_DOCS=true`。

## 主要接口

- `POST /api/auth/register` 用户注册
- `POST /api/auth/login` 用户登录
- `GET /api/expeditions` 远征列表
- `POST /api/expeditions` 创建远征（需登录）
- `POST /api/sos/alert` 创建 SOS 告警
- `GET /api/guides` 向导列表
- `POST /api/payment/wechat/qrcode` 微信支付二维码（需登录）
- `GET /api/admin/stats` 管理统计（管理员）
