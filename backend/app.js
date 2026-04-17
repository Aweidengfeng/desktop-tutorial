require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

// 从根目录启动(node backend/app.js)，process.cwd() = /app (仓库根目录)
const rootPath = process.cwd();
console.log('📁 根目录:', rootPath);
console.log('📁 __dirname:', __dirname);

// 静态文件服务 - 根目录
app.use(express.static(rootPath));

// 上传文件静态服务
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// 专门处理HTML文件路由（避免中文文件名问题）
const htmlFile = path.join(rootPath, '攀登4-20260416-summitlink.html');
app.get(['/summitlink', '/summitlink.html'], (req, res) => {
  console.log('📄 请求HTML文件:', htmlFile);
  console.log('📄 文件存在:', fs.existsSync(htmlFile));
  const amapKey = process.env.AMAP_KEY || 'YOUR_AMAP_KEY';
  fs.readFile(htmlFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取HTML文件失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    const result = html.replace('YOUR_AMAP_KEY', amapKey);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result);
  });
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
app.use('/api/comments', require('./routes/comments'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/follows', require('./routes/follows'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/customs', require('./routes/customs'));
app.use('/api/rescue', require('./routes/rescue'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/users', require('./routes/users'));

// Admin 面板
const adminHtmlFile = path.join(rootPath, 'admin.html');
app.get('/admin', (req, res) => {
  res.sendFile(adminHtmlFile);
});

// 健康检查
app.get('/health', (req, res) => {
  const exists = fs.existsSync(htmlFile);
  const files = fs.readdirSync(rootPath);
  res.json({ status: 'ok', rootPath, htmlExists: exists, htmlPath: htmlFile, rootFiles: files });
});

// 根路径
app.get('/', (req, res) => {
  res.redirect('/summitlink');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ SummitLink运行在 http://localhost:' + PORT);
  console.log('   HTML存在: ' + fs.existsSync(htmlFile));
});
