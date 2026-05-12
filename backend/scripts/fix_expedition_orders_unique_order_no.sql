-- 修复 expedition_orders.order_no 重复值，供 PostgreSQL 运维应急参考。
-- 幂等：仅处理每组重复中的 rn > 1 行；重复执行时无变更。

WITH dups AS (
  SELECT
    id,
    order_no,
    ROW_NUMBER() OVER (PARTITION BY order_no ORDER BY created_at ASC, id ASC) AS rn
  FROM expedition_orders
  WHERE order_no IS NOT NULL AND order_no <> ''
)
UPDATE expedition_orders
SET order_no = expedition_orders.order_no || '-dup-' || expedition_orders.id
FROM dups
WHERE expedition_orders.id = dups.id
  AND dups.rn > 1;
