/**
 * pg-search-indexes.js — 为 PostgreSQL 创建全文搜索 GIN 索引
 * 仅在 DATABASE_PROVIDER=postgresql 时执行
 * 用法: node backend/scripts/pg-search-indexes.js
 */
const prisma = require('../db/prisma');

async function main() {
  if ((process.env.DATABASE_PROVIDER || 'sqlite') !== 'postgresql') {
    console.log('跳过：当前使用 SQLite，无需创建 GIN 索引');
    return;
  }
  console.log('创建全文搜索 GIN 索引...');
  const indexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_peaks_fts ON peaks USING GIN(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(description,'')))`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guides_fts ON guides USING GIN(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(specialty,'') || ' ' || coalesce(region,'')))`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clubs_fts ON clubs USING GIN(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(specialty,'')))`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_fts ON posts USING GIN(to_tsvector('simple', coalesce(content,'')))`,
    `CREATE INDEX IF NOT EXISTS idx_peaks_name ON peaks(name)`,
    `CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status)`,
  ];
  for (const sql of indexes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅', sql.slice(0, 60) + '...');
    } catch (e) {
      console.warn('⚠️  跳过（可能已存在）:', e.message.slice(0, 80));
    }
  }
  console.log('\n✅ GIN 索引创建完成');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
