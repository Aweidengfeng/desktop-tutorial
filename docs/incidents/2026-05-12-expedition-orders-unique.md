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
