#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../backend/db/summitlink.db');
const backupsDir = process.env.BACKUPS_DIR || '/data/backups';

if (!fs.existsSync(backupsDir)) {
  try { fs.mkdirSync(backupsDir, { recursive: true }); } catch(e) {
    console.error('Cannot create backups dir:', e.message);
    process.exit(1);
  }
}

if (!fs.existsSync(dbPath)) {
  console.error('Database not found:', dbPath);
  process.exit(1);
}

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
const destFile = path.join(backupsDir, `summitlink-${timestamp}.db.gz`);

const readStream = fs.createReadStream(dbPath);
const writeStream = fs.createWriteStream(destFile);
const gzip = zlib.createGzip();

readStream.pipe(gzip).pipe(writeStream);

readStream.on('error', e => { console.error('Backup read error:', e.message); process.exit(1); });

writeStream.on('finish', () => {
  console.log(`✅ Backup created: ${destFile}`);

  // Cleanup files older than 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  fs.readdirSync(backupsDir).forEach(f => {
    if (!f.endsWith('.db.gz')) return;
    const fp = path.join(backupsDir, f);
    const stat = fs.statSync(fp);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      console.log(`🗑️  Removed old backup: ${f}`);
    }
  });
});

writeStream.on('error', e => { console.error('Backup failed:', e.message); process.exit(1); });
