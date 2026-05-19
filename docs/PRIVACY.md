# 隐私功能说明（GDPR）

## 数据导出

- 接口：`GET /api/gdpr/export`
- 鉴权：需要登录（Bearer JWT）
- 返回：当前登录用户的个人数据 JSON（用户资料、轨迹、预约、消息、帖子）
- 前端入口：我的 → 设置 → 隐私设置 →「导出我的数据（JSON）」

## 账号注销（软删除）

- 接口：`DELETE /api/gdpr/delete-account`
- 鉴权：需要登录（Bearer JWT）
- 行为：写入 `users.deleted_at`，并清空主要 PII 字段（phone/email/password/avatar/bio 等）
- 前端入口：我的 → 设置 → 隐私设置 →「注销账号」（二次确认）

> 说明：当前为软删除策略，用于满足合规审计与可追踪要求；真实物理删除策略可在后续归档任务中扩展。
