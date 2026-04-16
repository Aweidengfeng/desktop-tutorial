require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// HTML在仓库根目录，backend在子目录
// __dirname = /app/backend，所以根目录是 __dirname/..
const rootPath = path.join(__dirname, '..');
app.use(express.static(rootPath));
app.use(express.static(path.join(__dirname)));

console.log('📁 静态文件根目录:', rootPath);

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
app.get('/health', (req, res) => res.json({ status: 'ok', staticRoot: rootPath }));

// 根路径重定向到最新前端
app.get('/', (req, res) => {
  res.redirect('/攀登4-20260416-summitlink.html');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SummitLink后端运行在 http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/攀登4-20260416-summitlink.html`);
  console.log(`   静态文件目录: ${rootPath}`);
});