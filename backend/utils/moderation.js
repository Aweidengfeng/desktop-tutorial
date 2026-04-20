const fs = require('fs');
const path = require('path');

let blocklist = [];
const blocklistPath = path.join(__dirname, '../config/blocklist.txt');

function loadBlocklist() {
  try {
    const content = fs.readFileSync(blocklistPath, 'utf8');
    blocklist = content.split('\n').map(w => w.trim()).filter(Boolean);
  } catch(e) { blocklist = []; }
}

loadBlocklist();
// Hot reload every 5 minutes
setInterval(loadBlocklist, 5 * 60 * 1000);

function checkText(text) {
  if (!text) return { ok: true };
  const lower = text.toLowerCase();
  for (const word of blocklist) {
    if (lower.includes(word.toLowerCase())) {
      return { ok: false, reason: `内容包含违禁词: ${word}` };
    }
  }
  return { ok: true };
}

async function checkImage(buffer) {
  // TODO: 接入阿里云/腾讯云内容安全
  return { ok: true };
}

module.exports = { checkText, checkImage };
