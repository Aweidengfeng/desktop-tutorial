# 事故复盘：2026-05-12 Railway 生产崩溃（`expedition_orders.order_no` 唯一约束）

## 时间线
- 2026-05-12 20:33 (GMT+8)：Railway 部署 `8bd6386b` 启动失败，服务进入 Crashed 循环。
- 2026-05-12 20:33 ~ 21:16：日志持续报 `prisma db push` 因 `order_no` 重复导致唯一约束无法落地。
- 2026-05-12：在 PR #142 增加启动前数据清洗脚本并接入 `generate-prisma-client.js`。

## 根因
- PR #135（commit `10ec6ef`）在 `ExpeditionOrder.orderNo` 上引入 `@unique`，意图是对齐真实订单模型并约束订单号唯一。
- 生产库已有历史重复 `order_no`，`prisma db push` 检测到潜在数据丢失风险后拒绝继续执行，容器启动阶段退出。

## 修复方案（PR #142）
1. 新增 `backend/scripts/fix-duplicate-order-no.js`：
   - dry-run 先输出重复行数与样本；
   - 在事务内将每组重复 `rn>1` 的 `order_no` 改为 `原值-dup-{id}`；
   - 幂等：重复执行时无变更。
2. 启动脚本 `backend/scripts/generate-prisma-client.js --push` 先执行修复，再执行 `prisma db push`。
3. 失败提示增加手动应急命令。

## 上线恢复步骤（Railway）
1. 合并 PR #142。
2. Railway Dashboard 手动触发 redeploy（或等待自动部署）。
3. 在首次部署日志确认出现：
   - `已修复 N 行重复 order_no，保留最早的 M 个原值`
   - `prisma db push` 成功完成
4. 验证 `GET /api/health` 返回 200。

## 防止再次发生
- PR 模板新增检查项：
  - “是否引入 unique 约束？”
  - “若是，是否已在生产数据上验证无重复或已提供数据迁移脚本？”

---

## 续：PR #142 修复不完整（2026-05-12 后续）

### 新发现
1. `activity_orders` 表同样在 schema 中添加了 `order_no @unique` 约束，但 PR #142 的清洗脚本只覆盖了 `expedition_orders`。
2. 生产 DB 是全新部署（表不存在），但 Prisma 保守地对任何"加 unique 约束"的 diff 发出 data-loss 警告并拒绝执行，即使表为空。

### 修复方案（续）
PR #143 引入：
1. `TARGETS` 数组作为单一信息源，一次性涵盖 `expedition_orders` 和 `activity_orders`。
2. `precheckUniqueConstraints()`：在 `prisma db push` 前检查所有目标表，若全部为空/不存在/无重复，则自动加 `--accept-data-loss`；否则 fail-fast。
3. `fixAllTargets()`：独立处理每张表，单表失败不影响其他表。

### 教训（Lesson Learned）

> **教训**：未来在 Prisma schema 中添加 `@unique` 约束时，必须在 PR 描述中列出**所有受影响的 (表, 列)**，否则清洗脚本可能遗漏其他表。已在 `scripts/fix-duplicate-order-no.js` 引入 `TARGETS` 数组作为单一信息源，新加列只需追加 1 行。

### 部署后预期 Railway 日志
```
[generate-prisma-client] 正在执行 order_no 重复数据预清洗...
[fix-duplicate-unique-columns] expedition_orders.order_no: 表不存在，跳过
[fix-duplicate-unique-columns] activity_orders.order_no:   表不存在，跳过
[generate-prisma-client] 正在执行前置安全检查...
[precheck] ✅ expedition_orders.order_no: 表不存在（全新部署，安全）
[precheck] ✅ activity_orders.order_no: 表不存在（全新部署，安全）
[generate-prisma-client] 前置安全检查通过：2 张目标表（0 张需清洗，2 张不存在/空，0 张已清洗）
[generate-prisma-client] 安全执行 prisma db push --accept-data-loss
🚀  Your database is now in sync with your Prisma schema.
```

### 运维手动验证恢复

```bash
curl -s https://desktop-tutorial-production-182a.up.railway.app/api/health | jq .
```
