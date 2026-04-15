require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// 提供父目录的静态文件，使前端HTML可通过 http://localhost:3000 访问
app.use(express.static(path.join(__dirname, '..')));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SummitLink后端运行在 http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/攀登3-20260415-summitlink.html`);
});
