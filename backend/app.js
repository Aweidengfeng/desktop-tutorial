require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

// HTML在仓库根目录，startCommand是cd backend && node app.js
// 所以__dirname = /app/backend，根目录是上一层
const rootPath = path.join(__dirname, '..');
app.use(express.static(rootPath));
app.use(express.static(path.join(__dirname)));

console.log('📁 静态文件根目录:', rootPath);

// 专门处理中文文件名（Linux上express.static可能无法处理中文文件名）
const htmlFile = path.join(rootPath, '攀登4-20260416-summitlink.html');
app.get(['/summitlink', '/summitlink.html', '/%E6%94%80%E7%99%BB4-20260416-summitlink.html'], (req, res) => {
  res.sendFile(htmlFile);
});

// 挂载路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/peaks', require('./routes/peaks'));
app.use('/api/guides', require('./routes/guides'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/gear', require('./routes/gear'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/pay', require('./routes/pay'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// 健康检查
app.get('/health', (req, res) => {
  const exists = fs.existsSync(htmlFile);
  res.json({ status: 'ok', staticRoot: rootPath, htmlExists: exists, htmlPath: htmlFile });
});

// 根路径重定向到最新前端
app.get('/', (req, res) => {
  res.redirect('/summitlink');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SummitLink后端运行在 http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/summitlink`);
  console.log(`   静态文件目录: ${rootPath}`);
  console.log(`   HTML文件存在: ${fs.existsSync(htmlFile)}`);
});
