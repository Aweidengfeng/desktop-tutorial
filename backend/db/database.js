const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'summitlink.db'));

// 开启WAL模式提高性能
db.pragma('journal_mode = WAL');

// 建表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT,
  avatar TEXT,
  level TEXT DEFAULT '初级攀登者',
  summits INTEGER DEFAULT 0,
  expeditions INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  name_en TEXT,
  altitude INTEGER,
  country TEXT,
  continent TEXT,
  difficulty TEXT,
  image TEXT,
  type TEXT,
  description TEXT,
  best_season TEXT,
  success_rate TEXT,
  first_ascent TEXT,
  deaths INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  avatar TEXT,
  flag TEXT,
  nationality TEXT,
  rating REAL DEFAULT 5.0,
  reviews INTEGER DEFAULT 0,
  specialty TEXT,
  day_rate INTEGER,
  cert TEXT,
  languages TEXT,
  region TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  peak TEXT,
  date TEXT,
  spots INTEGER,
  total_spots INTEGER,
  level TEXT,
  leader TEXT,
  leader_avatar TEXT,
  leader_id INTEGER,
  description TEXT,
  status TEXT DEFAULT 'recruiting',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  date TEXT,
  distance REAL,
  elevation INTEGER,
  duration TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gear (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER,
  name TEXT,
  brand TEXT,
  price REAL,
  condition_text TEXT,
  image TEXT,
  description TEXT,
  mode TEXT DEFAULT 'buy',
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT,
  image TEXT,
  location TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS summit_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  avatar TEXT,
  flag TEXT,
  peak TEXT,
  date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  cert TEXT,
  specialty TEXT,
  languages TEXT,
  day_rate INTEGER,
  region TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_no TEXT UNIQUE,
  amount REAL,
  method TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;
