// 商业攀登数据拆分到 modules/commercial.js

const PEAK_DETAIL_FALLBACK = {
  '珠穆朗玛峰': { altitude: 8849, firstAscent: '1953-05-29', firstAscentBy: '埃德蒙·希拉里、丹增·诺尔盖', locationDetail: '中国西藏/尼泊尔交界，喜马拉雅山脉', difficulty: '极难', bestSeason: '春季(4-5月)', description: '世界最高峰，常见商业线路为南坡东南山脊与北坡东北山脊。' },
  'K2': { altitude: 8611, firstAscent: '1954-07-31', firstAscentBy: '阿基里·孔帕尼奥尼、利诺·拉切代利', locationDetail: '喀喇昆仑山脉，巴基斯坦/中国边境', difficulty: '极难', bestSeason: '夏季(6-8月)', description: '技术难度与客观风险极高，被称为“野蛮之山”。' },
  '干城章嘉峰': { altitude: 8586, firstAscent: '1955-05-25', firstAscentBy: '乔治·班德、乔·布朗', locationDetail: '印度/尼泊尔边界，喜马拉雅山脉', difficulty: '极难', bestSeason: '春季(4-5月)', description: '世界第三高峰，气候多变，攀登窗口短。' },
  '洛子峰': { altitude: 8516, firstAscent: '1956-05-18', firstAscentBy: '恩斯特·赖斯、弗里茨·卢克辛格', locationDetail: '珠峰南侧，中国/尼泊尔边境', difficulty: '极难', bestSeason: '春季(4-5月)', description: '与珠峰共享部分路线，后段技术性显著提升。' },
  '马卡鲁峰': { altitude: 8485, firstAscent: '1955-05-15', firstAscentBy: '让·库西、利昂内尔·特雷', locationDetail: '中国/尼泊尔边境，喜马拉雅山脉', difficulty: '极难', bestSeason: '春季(4-5月)', description: '金字塔形山体，后段攀登陡峭。' },
  '卓奥友峰': { altitude: 8201, firstAscent: '1954-10-19', firstAscentBy: '赫伯特·蒂希、塞帕·杰尔岑', locationDetail: '中国/尼泊尔边境，喜马拉雅山脉', difficulty: '高难', bestSeason: '秋季(9-10月)', description: '常被视作8000米级入门峰，但高海拔风险仍高。' },
  '道拉吉里峰': { altitude: 8167, firstAscent: '1960-05-13', firstAscentBy: '瑞士/奥地利联合队', locationDetail: '尼泊尔中西部，喜马拉雅山脉', difficulty: '极难', bestSeason: '春季(4-5月)', description: '气流复杂，雪崩与落石风险较高。' },
  '马纳斯卢峰': { altitude: 8163, firstAscent: '1956-05-09', firstAscentBy: '今西寿雄、甲斐宗次', locationDetail: '尼泊尔中部，喜马拉雅山脉', difficulty: '高难', bestSeason: '秋季(9-10月)', description: '近年来商业队增多，需重点防范雪崩风险。' },
  '南迦帕尔巴特峰': { altitude: 8126, firstAscent: '1953-07-03', firstAscentBy: '赫尔曼·布尔', locationDetail: '巴基斯坦吉尔吉特-巴尔蒂斯坦', difficulty: '极难', bestSeason: '夏季(6-8月)', description: '独立山体突出，历史事故多。' },
  '安纳普尔纳峰': { altitude: 8091, firstAscent: '1950-06-03', firstAscentBy: '莫里斯·埃尔佐格、路易·拉什纳尔', locationDetail: '尼泊尔中北部，喜马拉雅山脉', difficulty: '极难', bestSeason: '春季(4-5月)', description: '以雪崩风险著称，需严格窗口和队伍管理。' },
  '迦舒布鲁姆I峰': { altitude: 8080, firstAscent: '1958-07-05', firstAscentBy: '皮特·斯科宁、安迪·考夫曼', locationDetail: '喀喇昆仑山脉，巴基斯坦/中国边境', difficulty: '极难', bestSeason: '夏季(6-8月)', description: '冰裂缝与复杂雪坡并存。' },
  '布洛阿特峰': { altitude: 8051, firstAscent: '1957-06-09', firstAscentBy: '福里茨·温特施泰勒等4人', locationDetail: '喀喇昆仑山脉，巴基斯坦/中国边境', difficulty: '高难', bestSeason: '夏季(6-8月)', description: '常与K2同季攀登，天气变化迅速。' },
  '迦舒布鲁姆II峰': { altitude: 8034, firstAscent: '1956-07-07', firstAscentBy: '福里茨·莫拉韦克等3人', locationDetail: '喀喇昆仑山脉，巴基斯坦/中国边境', difficulty: '高难', bestSeason: '夏季(6-8月)', description: '相对“友好”的8000米峰，仍需高海拔经验。' },
  '希夏邦马峰': { altitude: 8027, firstAscent: '1964-05-02', firstAscentBy: '中国登山队', locationDetail: '中国西藏，喜马拉雅山脉', difficulty: '高难', bestSeason: '春季/秋季', description: '唯一完全位于中国境内的8000米级山峰。' },
  '麦金利山': { altitude: 6190, firstAscent: '1913-06-07', firstAscentBy: '哈德森·斯塔克队', locationDetail: '美国阿拉斯加', difficulty: '高难', bestSeason: '5-6月', description: '极寒与风暴是主要挑战。' },
  '阿空加瓜峰': { altitude: 6961, firstAscent: '1897-01-14', firstAscentBy: '马提亚斯·祖布里根', locationDetail: '阿根廷安第斯山脉', difficulty: '高难', bestSeason: '12-2月', description: '七大洲中最高的非技术峰之一。' },
  '乞力马扎罗山': { altitude: 5895, firstAscent: '1889-10-06', firstAscentBy: '汉斯·迈耶、路德维希·普切勒', locationDetail: '坦桑尼亚', difficulty: '中等', bestSeason: '1-3月/6-10月', description: '高海拔徒步线路成熟，适合高海拔适应训练。' },
  '厄尔布鲁士山': { altitude: 5642, firstAscent: '1874-08-10', firstAscentBy: '克劳福德·格罗夫团队', locationDetail: '俄罗斯高加索', difficulty: '中等', bestSeason: '6-8月', description: '欧洲最高峰，天气骤变频繁。' },
  '文森峰': { altitude: 4892, firstAscent: '1966-12-18', firstAscentBy: '尼古拉斯·克林奇队', locationDetail: '南极洲埃尔斯沃思山脉', difficulty: '高难', bestSeason: '11-1月', description: '后勤成本与极地气候是核心挑战。' },
  '科修斯科山': { altitude: 2228, firstAscent: '1840-03-12', firstAscentBy: '保罗·埃德蒙·斯特泽莱茨基', locationDetail: '澳大利亚新南威尔士州', difficulty: '入门', bestSeason: '11-3月', description: '七大洲体系中常用大洋洲峰，徒步难度低。' },
};

const PEAK_NAME_ALIASES = {
  '乔戈里峰': 'K2',
  '丹拿利峰': '麦金利山',
  '德纳里山': '麦金利山',
  '加舒尔布鲁姆I峰': '迦舒布鲁姆I峰',
  '加舒尔布鲁姆II峰': '迦舒布鲁姆II峰',
};

function enrichPeakDetail(peak = {}) {
  const normalizedName = PEAK_NAME_ALIASES[peak.name] || peak.name;
  const fallback = PEAK_DETAIL_FALLBACK[normalizedName];
  if (!fallback) return peak;
  return {
    ...fallback,
    ...peak,
    firstAscent: peak.firstAscent || fallback.firstAscent,
    bestSeason: peak.bestSeason || fallback.bestSeason,
    seasonDetail: peak.seasonDetail || fallback.bestSeason,
    description: peak.description || fallback.description,
    locationDetail: peak.locationDetail || fallback.locationDetail,
    firstAscentBy: peak.firstAscentBy || fallback.firstAscentBy,
    altitude: peak.altitude || fallback.altitude,
    difficulty: peak.difficulty || fallback.difficulty,
  };
}

// ─── 图片上传预校验工具函数（Phase 0.4）───────────────────────────────
function validateImageFile(file) {
  const MAX_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `不支持的格式（${file.type || '未知'}），请上传 JPG/PNG/GIF/WebP` };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `图片 ${(file.size / (1024 * 1024)).toFixed(1)}MB 超过 5MB 限制，请压缩后重试` };
  }
  return { valid: true, error: null };
}

function validateImageFiles(files) {
  const validFiles = [], errors = [];
  Array.from(files).forEach(file => {
    const r = validateImageFile(file);
    if (r.valid) validFiles.push(file);
    else errors.push(`${file.name}：${r.error}`);
  });
  return { validFiles, errors };
}
// ─────────────────────────────────────────────────────────────────────────

const _safeLsGet = (key, fallback = null) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    try { return JSON.parse(v); } catch (_) { return v; }
  } catch (_) {
    return fallback;
  }
};

const _fetchWithTimeout = (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

// ─── API Fetch 封装：统一处理 401 过期跳转（Phase 0.5）─────────────────────
async function apiFetch(url, options = {}) {
  // 安卓 Capacitor 端通过 window.__API_BASE__ 指向真实后端地址
  const apiBase = (window.__API_BASE__ || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') ? url : apiBase + url;
  const token = _safeLsGet('summitlink_token', null);
  const headers = {
    ...(options.headers || {}),
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  // 如果 body 是对象且没有设置 Content-Type，自动加 JSON 头
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options = { ...options, body: JSON.stringify(options.body) };
  }
  let res;
  try {
    res = await fetch(fullUrl, { ...options, headers, credentials: 'include' });
  } catch (e) {
    // 网络错误（断网/超时）
    throw new Error('网络连接失败，请检查网络后重试');
  }
  // 处理 503 支付/服务降级
  if (res.status === 503) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await res.json();
        console.warn('[SummitLink] 服务暂时不可用:', data.reason);
        throw new Error(data.message || '该功能暂时不可用，请稍后重试');
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error('服务暂时不可用，请稍后重试');
        }
        throw e;
      }
    }
    throw new Error('服务暂时不可用，请稍后重试');
  }
  // 401 — 尝试用 refreshToken 换新 accessToken，然后重试一次
  if (res.status === 401 && !options._refreshed) {
    const refreshToken = _safeLsGet('summitlink_refresh_token', null);
    if (refreshToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.token) {
            localStorage.setItem('summitlink_token', refreshData.token);
            if (refreshData.refreshToken) localStorage.setItem('summitlink_refresh_token', refreshData.refreshToken);
            // 重试原请求（标记 _refreshed 防止无限递归）
            const newHeaders = { ...headers, Authorization: 'Bearer ' + refreshData.token };
            return apiFetch(url, { ...options, headers: newHeaders, _refreshed: true });
          }
        }
      } catch (refreshErr) { console.error('[apiFetch] refresh token failed:', refreshErr && refreshErr.message); }
    }
    localStorage.removeItem('summitlink_token');
    localStorage.removeItem('summitlink_refresh_token');
    // 触发全局登出事件
    window.dispatchEvent(new CustomEvent('summitlink:session-expired'));
    throw new Error('登录已过期，请重新登录');
  }
  if (res.status === 401) {
    localStorage.removeItem('summitlink_token');
    localStorage.removeItem('summitlink_refresh_token');
    // 触发全局登出事件
    window.dispatchEvent(new CustomEvent('summitlink:session-expired'));
    throw new Error('登录已过期，请重新登录');
  }
  // 处理其他错误状态
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await res.json();
        throw new Error(data.error || data.message || `请求失败 (${res.status})`);
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error(`请求失败 (${res.status})`);
        }
        throw e;
      }
    }
    throw new Error(`请求失败 (${res.status})`);
  }
  return res;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Phase 2.3: IndexedDB 轨迹断点续传队列 ──────────────────────────────────
const _IDB_NAME = 'summitlink-db';
const _IDB_VERSION = 1;
const _IDB_STORE = 'pending-tracks';

function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE)) {
        const store = db.createObjectStore(_IDB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbSavePendingTrack(trackData) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    const record = {
      name: trackData.name,
      points: trackData.points || [],
      gpxFile: trackData.gpxFile || null,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retries: 0,
    };
    const req = store.add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbGetPendingTracks() {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readonly');
    const store = tx.objectStore(_IDB_STORE);
    const req = store.getAll();
    req.onsuccess = (e) => {
      const all = e.target.result || [];
      resolve(all.filter(t => t.status === 'pending' || t.status === 'failed'));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbDeletePendingTrack(id) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbUpdateTrackStatus(id, status, retries) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = (e) => {
      const record = e.target.result;
      if (!record) return resolve();
      record.status = status;
      if (retries !== undefined) record.retries = retries;
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = (ev) => reject(ev.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Phase 2.5: 地图引擎检测与 SDK 懒加载 ────────────────────────────────────
window.__activeMapProvider = 'amap';
const MAP_LAYER_STORAGE_KEY = 'summitlink_map_layer';
const EXPEDITION_SOCKET_NAMESPACE = '/expedition-tracking';
const MAP_LAYER_OPTIONS = [
  { key: 'standard', label: '标准', tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  { key: 'satellite', label: '卫星', tileUrl: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', attribution: '© AutoNavi' },
  { key: 'relief', label: '3D', tileUrl: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '© CARTO + OSM' },
  { key: 'contour', label: '等高线', tileUrl: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap contributors' },
];

async function detectMapProvider() {
  try {
    const res = await fetch('/api/config/map');
    if (res.ok) {
      const data = await res.json();
      // 后端返回 provider 字段；mapboxToken（新）或 token（旧）均支持
      const mbToken = data.mapboxToken || data.token || '';
      if (data.provider === 'mapbox') {
        window.__activeMapProvider = 'mapbox';
        return { provider: 'mapbox', token: mbToken };
      }
      if (data.provider === 'osm') {
        window.__activeMapProvider = 'osm';
        return {
          provider: 'osm',
          tileUrl: data.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: data.attribution || '© OpenStreetMap contributors',
        };
      }
      const amapKey = data.amapKey || '';
      const amapSecurityCode = data.amapSecurityCode || '';
      if (amapKey) {
        try {
          await loadAMap(amapKey, amapSecurityCode);
        } catch (e) {
          console.warn('[SummitLink] AMap 动态加载失败:', e && e.message ? e.message : e);
        }
      } else {
        console.warn('[SummitLink] /api/config/map 返回 amap 但未提供 amapKey');
      }
      return { provider: 'amap', amapKey };
    }
  } catch (e) {}
  window.__activeMapProvider = 'amap';
  console.warn('[SummitLink] 无法获取地图配置，地图功能不可用');
  return { provider: 'amap' };
}

/**
 * 动态加载高德地图 SDK
 * 必须先注入 window._AMapSecurityConfig，再加载 AMap JS SDK
 */
function loadAMap(amapKey, securityCode) {
  return new Promise((resolve, reject) => {
    if (window.AMap && typeof window.AMap.Map === 'function') { resolve(); return; }
    if (!amapKey) {
      reject(new Error('AMap key is required'));
      return;
    }
    // 1. 注入安全密钥（必须先于 SDK 脚本）
    if (securityCode) {
      window._AMapSecurityConfig = { securityJsCode: securityCode };
    }
    // 2. 动态加载 AMap SDK
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}`;
    script.onload = resolve;
    script.onerror = () => {
      console.error('[SummitLink] AMap SDK 加载失败，请检查 AMAP_KEY 是否正确');
      reject(new Error('AMap SDK load failed'));
    };
    document.head.appendChild(script);
  });
}

function loadMapboxGL(token) {
  return new Promise((resolve, reject) => {
    if (window.mapboxgl) { if (token) window.mapboxgl.accessToken = token; resolve(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => { if (token) window.mapboxgl.accessToken = token; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }

    const leafletCssUrl = '/vendor/leaflet/leaflet.css';
    const leafletJsUrl = '/vendor/leaflet/leaflet.js';

    const existingCss = document.querySelector('link[data-map="leaflet"]');
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = leafletCssUrl;
      link.setAttribute('data-map', 'leaflet');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-map="leaflet"]');
    if (existingScript) {
      if (window.L) { resolve(); return; }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Leaflet failed to load from local assets: ' + leafletJsUrl)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = leafletJsUrl;
    script.setAttribute('data-map', 'leaflet');
    script.onload = () => {
      if (window.L) {
        resolve();
        return;
      }
      reject(new Error('Leaflet loaded but window.L is unavailable.'));
    };
    script.onerror = () => reject(new Error('Leaflet failed to load from local assets: ' + leafletJsUrl));
    document.head.appendChild(script);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function alpineLink() {
  const savedMapLayer = _safeLsGet(MAP_LAYER_STORAGE_KEY, null);
  const activeMapLayer = MAP_LAYER_OPTIONS.some(layer => layer.key === savedMapLayer) ? savedMapLayer : 'standard';
  return {
    currentPage: 'home',
    currentUser: null,
    authToken: _safeLsGet('summitlink_token', null),
    _wasLoggedIn: false,
    paymentsEnabled: false,
    stripePublishableKey: '',
    stripeClient: null,
    stripeLoadPromise: null,
    _locationSocket: null,
    _locationPollTimer: null,
    locationConnectionMode: 'none',
    expeditionLocationPollMs: 30000,
    teamMembers: [],
    notifUnreadCount: 0,
    notifUnreadList: [],
    notifPanelOpen: false,
    userStats: { expeditionCount: null, totalKm: null, climbingDays: null },
    _loadMyOrdersRequestId: 0,
    _guideStatusRequestId: 0,
    _clubStatusRequestId: 0,
    showLogin: false,
    showBiometricLogin: false,
    showRegister: false,
    loginLoading: false,
    loginType: 'password',
    smsCode: '',
    smsCountdown: 0,
    smsTimer: null,
    loginForm: { account: '', phone: '', password: '' },
    registerForm: { name: '', phone: '', password: '', inviteCode: '' },
    showInviteCodeInput: false,
    myInviteCode: '',
    inviteUrl: '',
    inviteStats: { totalInvited: 0, totalPoints: 0 },
    inviteRecords: [],
    inviteRecordsLoading: false,
    showInviteRecords: false,
    agreedPrivacy: false,
    agreedTerms: false,
    POLICY_VERSION: '2026-04-20',
    privacySettings: { profile_public: true, posts_public: true, follows_public: true, allow_stranger_msg: false },
    gearImageUploading: false,
    // Phase 2 - Track Recording state is kept initialized so dormant flows stay reactive.
    trackRecordedPoints: [],
    heroSlide: 0,
    heroTouchStartX: 0,
    heroSlides: [
      { name: '珠穆朗玛峰', sub: '海拔 8,849m · 中国/尼泊尔 · 世界之巅', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', linkType: 'peak', linkTarget: 'everest' },
      { name: 'K2 乔戈里峰', sub: '海拔 8,611m · 巴基斯坦/中国 · 野蛮巨峰', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', linkType: 'peak', linkTarget: 'k2' },
      { name: '麦金利山 Denali', sub: '海拔 6,190m · 阿拉斯加 · 北美之巅', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', linkType: 'peak', linkTarget: 'denali' },
      { name: '马特洪峰 Matterhorn', sub: '海拔 4,478m · 瑞士/意大利 · 阿尔卑斯标志', image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', linkType: 'page', linkTarget: 'explore' },
      { name: '阿玛达布拉姆', sub: '海拔 6,814m · 尼泊尔 · 喜马拉雅最美', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', linkType: 'page', linkTarget: 'explore' },
      { name: '乞力马扎罗山', sub: '海拔 5,895m · 坦桑尼亚 · 非洲之巅', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', linkType: 'page', linkTarget: 'explore' },
    ],
    activeCategory: '8000ers',
    gearMode: 'buy',
    gearCategory: '全部',
    activeChatType: 'all',
    communityTabs: [
      { id: 'all', name: '全部' },
      { id: 'posts', name: '动态' },
      { id: 'diary', name: '日记' },
      { id: 'teams', name: '组队' },
      { id: 'articles', name: '攻略' },
      { id: 'clubs', name: '俱乐部' },
    ],
    lang: 'zh-CN',
    currentLang: 'zh',
    locale: _safeLsGet('sl_lang', null) || _safeLsGet('locale', null) || 'zh-CN',
    _i18nCache: {},
    showLangPicker: false,
    showSearch: false,
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    searchHistory: ['珠穆朗玛峰', 'K2', '马特洪峰'],
    useMetric: true,
    currentCurrency: 'CNY',
    showPeakDetail: false,
    selectedPeak: null,
    peakWeather: null,
    peakForecast: [],
    peakWeatherLoading: false,
    peakCampWeathers: [],
    peakCampWeathersLoading: false,
    weatherSearch: '',
    weatherSearchResult: null,
    weatherSearchForecast: [],
    weatherSearchCamps: [],
    weatherSearchLoading: false,
    showWeatherSearchResult: false,
    // 商业攀登数据
    commercialPeaks: [],
    commercialFilter: { region: '', difficulty: '', sortBy: 'altitude' },
    commercialView: 'all',
    // OSM 地名查询状态
    osmSuggestions: [],
    osmSuggestionsLoading: false,
    showOsmSuggestions: false,
    osmLastRequestTime: 0,
    osmSearchDebounceTimer: null,
    showBooking: false,
    showPayment: false,
    bookingData: { mountain: null, date: '', guide: null, guide_id: null, guide_name: '', club_id: null, club_name: '', members: 1, notes: '', coupon_id: null },
    showCouponsCenter: false,
    couponClaimCode: '',
    couponTab: 'unused',
    myCouponsByStatus: { unused: [], used: [], expired: [] },
    couponsLoading: false,
    couponClaimLoading: false,
    showBookingCouponPanel: false,
    bookingAvailableCoupons: [],
    selectedBookingCoupon: null,
    bookingCouponPreview: null,
    showSOS: false,
    showSOSConfirm: false,
    sosCountdown: 5,
    sosCountdownTimer: null,
    sosEmergencyPhone: '112',
    sosLocation: null,
    sosLocationLoading: false,
    sosLocationError: null,
    sosLoading: false,
    sosStatus: 'pending',
    sosId: null,
    sosPeakName: '',
    sosMessage: '',
    sosHistory: [],
    sosSentAt: null,
    sosPollCountdown: 30,
    _sosStatusTimer: null,
    _sosStatusCountdownTimer: null,
    // Phase 2 - Track Recording state
    mapSearchExpanded: false,
    mapSearchQuery: '',
    showTrackLayerPanel: false,
    showOfflineMapModal: false,
    offlineMapProgress: 0,
    isOffline: !navigator.onLine,
    showChatWindow: false,
    activeChatSession: null,
    chatSubTab: 'all',
    meSubPage: 'profile',
    postsLoading: true,
    peaksLoading: false,
    teamsLoading: true,
    chatSessions: [],
    chatLoading: false,
    sosStep: 0,
    sosImages: [],
    showSettings: false,
    settingsType: 'profile',
    accountDeletionLoading: false,
    showComments: false,
    selectedPostForComment: null,
    showShare: false,
    selectedPostForShare: null,
    showPostEditor: false,
    newPost: { content: '', location: '', images: [], videoPreview: '', videoFile: null, videoUrl: '', category: 'post' },
    showPostEmojiPicker: false,
    showChat: false,
    activeChatConv: null,
    chatInput: '',
    chatImagePreviews: [],
    chatVideoPreview: '',
    chatVideoFile: null,
    commentImagePreviews: [],
    _chatSocket: null,
    _socketBoundConversations: new Set(),
    lightboxUrl: '',
    showLightbox: false,
    trackMap: null,
    trackMapEngine: 'amap',
    trackTileLayer: null,
    trackLocationMarker: null,
    mapLayerOptions: MAP_LAYER_OPTIONS,
    activeMapLayer,
    _mapCore: null,
    _mapCoreLoading: null,
    _weatherModuleLoaded: false,
    _commercialModuleLoaded: false,
    _communityModuleLoaded: false,
    _weatherModuleFailed: false,
    _commercialModuleFailed: false,
    _communityModuleFailed: false,
    _weatherModuleLoading: null,
    _commercialModuleLoading: null,
    _communityModuleLoading: null,
    amapAvailable: typeof AMap !== 'undefined',
    pendingUploadCount: 0,
    recordingMap: null,
    selectedConversation: null,
    showChatDetail: false,
    showGearPublish: false,
    showGearPurchase: false,
    gearPurchaseItem: null,
    gearPurchaseForm: { receiver_name: '', receiver_phone: '', address: '' },
    gearPurchaseLoading: false,
    gearOrders: [],
    gearOrdersLoading: false,
    newGear: { name: '', brand: '', price: '', condition: 'good', description: '', images: [] },
    showTeamDetail: false,
    selectedTeam: null,
    showCreateTeam: false,
    newTeam: { name: '', peak: '', date: '', level: '', spots: 4, description: '' },
    showManualSummitModal: false,
    manualSummit: { peak_name: '', date: '', altitude: '', notes: '', proof_images: [] },
    showInsurance: false,
    insuranceRegion: '喜马拉雅',
    insurancePlans: [],
    insurancePlansLoading: false,
    showInsuranceInquiry: false,
    selectedInsurancePlan: null,
    insuranceInquiry: { name: '', phone: '', peak_name: '', departure_date: '' },
    paymentAmount: 0,
    paymentMethod: 'alipay',
    wechatPayModal: { open: false, codeUrl: '', orderNo: '', amount: 0, countdown: '3:00' },
    stripeModal: { open: false, clientSecret: '', error: '', loading: false },
    showAlipayConfirm: false,
    pendingAlipayOrderNo: '',
    _wechatPayTimer: null,
    _stripeCard: null,
    showTrackDetail: false,
    selectedTrackDetail: null,
    featuredClubs: [],
    popularPeaksWeather: [
      { name: '珠穆朗玛峰', nameEn: 'Mt. Everest', altitude: 8849, temp: -28, wind: 45, humidity: 32, condition: '晴', conditionIcon: '☀️' },
      { name: 'K2', nameEn: 'K2', altitude: 8611, temp: -35, wind: 62, humidity: 25, condition: '多云', conditionIcon: '⛅' },
      { name: '丹拿利峰', nameEn: 'Denali', altitude: 6190, temp: -22, wind: 38, humidity: 55, condition: '阴', conditionIcon: '☁️' },
      { name: '白朗峰', nameEn: 'Mont Blanc', altitude: 4808, temp: -12, wind: 28, humidity: 70, condition: '小雪', conditionIcon: '🌨️' },
      { name: '厄尔布鲁士', nameEn: 'Elbrus', altitude: 5642, temp: -18, wind: 32, humidity: 48, condition: '晴', conditionIcon: '☀️' },
      { name: '阿玛达布拉姆', nameEn: 'Ama Dablam', altitude: 6814, temp: -15, wind: 22, humidity: 40, condition: '晴', conditionIcon: '☀️' },
    ],
    activePopularPeak: null,
    popularPeakWeatherDetail: null,
    popularPeakWeatherLoading: false,
    banners: [],
    // 我的成就
    showAchievementsModal: false,
    achievementsList: [],
    achievementsLoading: false,
    // 会员中心
    showMembershipModal: false,
    membershipData: null,
    membershipLoading: false,
    communitySearchQuery: '',
    filteredCommunityPosts: [],
    showGuideApply: false,
    guideApplyForm: { name: '', cert: '', specialty: '', languages: '', dayRate: '', region: '' },
    showClubApplyModal: false,
    clubApplyForm: { club_name: '', cert_url: '', contact: '', wechat: '', specialty: '', region: '', description: '', website: '' },
    showGuideDetail: false,
    showGuideProfile: false,
    selectedGuide: null,
    showGuideProfileModal: false,
    currentGuideProfile: null,
    guideReviewForm: { rating: 5, content: '' },
    showClubProfileModal: false,
    currentClubProfile: null,
    clubActivityTab: 'activity',
    clubReviewForm: { rating: 5, content: '' },
    showPublishActivity: false,
    newActivity: { title: '', type: 'activity', mountain: '', region: '', price: '', max_members: 10, start_date: '', end_date: '', difficulty: '', description: '' },
    showNotificationCenter: false,
    notifications: [],
    notificationCount: 0,
    // 帮助与反馈
    feedbackForm: { type: 'suggestion', content: '', contact: '' },
    feedbackSubmitting: false,
    // 消息通知面板（设置页内）
    notifSettingsList: [],
    notifSettingsLoading: false,
    notifPreferences: {
      order_updates: true,
      booking_updates: true,
      activity_reminders: true,
      system_notices: true,
      marketing: false,
    },
    notifPreferencesLoading: false,
    summitWindow: [],
    summitWindowExpanded: -1,
    showCertModal: false,
    certTrackId: null,
    showRejectReason: false,
    rejectReason: '',
    rejectingNotif: null,
    showMyBookings: false,
    myBookings: [],
    myBookingsLoading: false,
    showIncomingBookings: false,
    incomingBookings: [],
    incomingBookingsLoading: false,
    showExpeditionDetail: false,
    selectedExpedition: null,
    showClubDetail: false,
    selectedClub: null,
    showArticle: false,
    showGearDetail: false,
    selectedGear: null,
    showWorldPeakDetail: false,
    selectedWorldPeak: null,
    showAlpineDetail: false,
    selectedAlpine: null,
    // Articles / 攻略知识库
    articles: [],
    articleCategory: 'all',
    showArticleDetail: false,
    selectedArticle: null,
    articlesLoading: false,
    // Customs / 定制攀登
    showCustomsForm: false,
    customsForm: { peak_name: '', preferred_date: '', group_size: 1, notes: '', contact_phone: '' },
    customsSubmitted: false,
    customsOrderId: null,
    // Profile sub-sections
    medicalInfo: { blood_type: '', allergies: '', health_notes: '' },
    medicalInfoLoaded: false,
    userEmergencyContacts: [],
    showAddContact: false,
    newContact: { name: '', relationship: '', phone: '' },
    userGearChecklist: [],
    newGearItemName: '',
    userFavorites: [],
    meSection: 'profile',
    // Rescue contacts
    rescueContacts: [],
    toasts: [],
    _toastIdCounter: 0,
    _homeDataLoadedOnce: false,
    _initError: false,
    _initErrorMsg: '',
    newComment: '',
    selectedPostComments: [],
    commentsLoading: false,
    availableLangs: [
      { code: 'zh-CN', native: '中文', sub: '简体中文' },
      { code: 'en', native: 'English', sub: 'English' },
      { code: 'ne', native: 'नेपाली', sub: 'Nepali' },
    ],
    translations: {
      zh: { app_name: '巅峰探索', summit: '峰顶', search: '搜索', language: '语言', home: '首页', explore: '探索', community: '社区', track: '轨迹', gear: '装备', me: '我的', booking: '预约', submit: '提交', cancel: '取消', close: '关闭', save: '保存', confirm: '确认', back: '返回', edit: '编辑', delete: '删除', share: '分享', like: '点赞', comment: '评论', follow: '关注', login: '登录', logout: '退出', settings: '设置', sos: 'SOS 紧急救援', loading: '加载中...', success: '成功', error: '错误', weather: '天气', altitude: '海拔', difficulty: '难度', country: '国家', price: '价格', date: '日期', guide: '向导', members: '成员', notes: '备注', send_sos: '发送 SOS', book_now: '立即预约', peak_detail: '山峰详情', booking_title: '预约攀登' },
      en: { app_name: 'SummitLink', summit: 'Summit', search: 'Search', language: 'Language', home: 'Home', explore: 'Explore', community: 'Community', track: 'Track', gear: 'Gear', me: 'Me', booking: 'Booking', submit: 'Submit', cancel: 'Cancel', close: 'Close', save: 'Save', confirm: 'Confirm', back: 'Back', edit: 'Edit', delete: 'Delete', share: 'Share', like: 'Like', comment: 'Comment', follow: 'Follow', login: 'Login', logout: 'Logout', settings: 'Settings', sos: 'SOS Emergency', loading: 'Loading...', success: 'Success', error: 'Error', weather: 'Weather', altitude: 'Altitude', difficulty: 'Difficulty', country: 'Country', price: 'Price', date: 'Date', guide: 'Guide', members: 'Members', notes: 'Notes', send_sos: 'Send SOS', book_now: 'Book Now', peak_detail: 'Peak Detail', booking_title: 'Book Climbing' },
      'zh-TW': { app_name: '巔峰探索', summit: '峰頂', search: '搜尋', language: '語言', home: '首頁', explore: '探索', community: '社群', track: '軌跡', gear: '裝備', me: '我的', booking: '預約', submit: '提交', cancel: '取消', close: '關閉', save: '儲存', confirm: '確認', back: '返回', edit: '編輯', delete: '刪除', share: '分享', like: '按讚', comment: '評論', follow: '追蹤', login: '登入', logout: '登出', settings: '設定', sos: 'SOS 緊急救援', loading: '載入中...', success: '成功', error: '錯誤', weather: '天氣', altitude: '海拔', difficulty: '難度', country: '國家', price: '價格', date: '日期', guide: '嚮導', members: '成員', notes: '備註', send_sos: '發送 SOS', book_now: '立即預約', peak_detail: '山峰詳情', booking_title: '預約攀登' },
      ja: { app_name: 'サミットリンク', summit: '山頂', search: '検索', language: '言語', home: 'ホーム', explore: '探索', community: 'コミュニティ', track: 'トラック', gear: 'ギア', me: '自分', booking: '予約', submit: '送信', cancel: 'キャンセル', close: '閉じる', save: '保存', confirm: '確認', back: '戻る', edit: '編集', delete: '削除', share: '共有', like: 'いいね', comment: 'コメント', follow: 'フォロー', login: 'ログイン', logout: 'ログアウト', settings: '設定', sos: 'SOS 緊急救助', loading: '読み込み中...', success: '成功', error: 'エラー', weather: '天気', altitude: '高度', difficulty: '難易度', country: '国', price: '価格', date: '日付', guide: 'ガイド', members: 'メンバー', notes: 'メモ', send_sos: 'SOS送信', book_now: '今すぐ予約', peak_detail: '山の詳細', booking_title: 'クライミング予約' },
      ne: { app_name: 'समिटलिंक', summit: 'शिखर', search: 'खोज्नुहोस्', language: 'भाषा', home: 'गृह', explore: 'अन्वेषण', community: 'समुदाय', track: 'ट्र्याक', gear: 'गियर', me: 'म', booking: 'बुकिङ', submit: 'पेश गर्नुहोस्', cancel: 'रद्द गर्नुहोस्', close: 'बन्द गर्नुहोस्', save: 'सुरक्षित', confirm: 'पुष्टि गर्नुहोस्', back: 'पछाडि', edit: 'सम्पादन', delete: 'मेटाउनुहोस्', share: 'साझा गर्नुहोस्', like: 'मन पर्छ', comment: 'टिप्पणी', follow: 'अनुसरण', login: 'लगिन', logout: 'लगआउट', settings: 'सेटिङ', sos: 'SOS आपतकालीन', loading: 'लोड हुँदैछ...', success: 'सफलता', error: 'त्रुटि', weather: 'मौसम', altitude: 'उचाइ', difficulty: 'कठिनाइ', country: 'देश', price: 'मूल्य', date: 'मिति', guide: 'गाइड', members: 'सदस्यहरू', notes: 'नोट', send_sos: 'SOS पठाउनुहोस्', book_now: 'अहिले बुक गर्नुहोस्', peak_detail: 'शिखर विवरण', booking_title: 'आरोहण बुकिङ' },
      hi: { app_name: 'समिटलिंक', summit: 'शिखर', search: 'खोजें', language: 'भाषा', home: 'होम', explore: 'अन्वेषण', community: 'समुदाय', track: 'ट्रैक', gear: 'गियर', me: 'मैं', booking: 'बुकिंग', submit: 'जमा करें', cancel: 'रद्द करें', close: 'बंद करें', save: 'सहेजें', confirm: 'पुष्टि करें', back: 'वापस', edit: 'संपादित करें', delete: 'हटाएं', share: 'साझा करें', like: 'पसंद', comment: 'टिप्पणी', follow: 'अनुसरण करें', login: 'लॉगिन', logout: 'लॉगआउट', settings: 'सेटिंग', sos: 'SOS आपातकालीन', loading: 'लोड हो रहा है...', success: 'सफलता', error: 'त्रुटि', weather: 'मौसम', altitude: 'ऊंचाई', difficulty: 'कठिनाई', country: 'देश', price: 'कीमत', date: 'तारीख', guide: 'गाइड', members: 'सदस्य', notes: 'नोट', send_sos: 'SOS भेजें', book_now: 'अभी बुक करें', peak_detail: 'शिखर विवरण', booking_title: 'आरोहण बुकिंग' },
      fr: { app_name: 'SommetsLink', summit: 'Sommet', search: 'Rechercher', language: 'Langue', home: 'Accueil', explore: 'Explorer', community: 'Communauté', track: 'Piste', gear: 'Équipement', me: 'Moi', booking: 'Réservation', submit: 'Soumettre', cancel: 'Annuler', close: 'Fermer', save: 'Enregistrer', confirm: 'Confirmer', back: 'Retour', edit: 'Modifier', delete: 'Supprimer', share: 'Partager', like: "J'aime", comment: 'Commenter', follow: 'Suivre', login: 'Connexion', logout: 'Déconnexion', settings: 'Paramètres', sos: 'SOS Urgence', loading: 'Chargement...', success: 'Succès', error: 'Erreur', weather: 'Météo', altitude: 'Altitude', difficulty: 'Difficulté', country: 'Pays', price: 'Prix', date: 'Date', guide: 'Guide', members: 'Membres', notes: 'Notes', send_sos: 'Envoyer SOS', book_now: 'Réserver maintenant', peak_detail: 'Détail du sommet', booking_title: "Réserver l'escalade" },
      it: { app_name: 'SummitLink', summit: 'Vetta', search: 'Cerca', language: 'Lingua', home: 'Home', explore: 'Esplora', community: 'Comunità', track: 'Percorso', gear: 'Attrezzatura', me: 'Io', booking: 'Prenotazione', submit: 'Invia', cancel: 'Annulla', close: 'Chiudi', save: 'Salva', confirm: 'Conferma', back: 'Indietro', edit: 'Modifica', delete: 'Elimina', share: 'Condividi', like: 'Mi piace', comment: 'Commenta', follow: 'Segui', login: 'Accedi', logout: 'Esci', settings: 'Impostazioni', sos: 'SOS Emergenza', loading: 'Caricamento...', success: 'Successo', error: 'Errore', weather: 'Meteo', altitude: 'Altitudine', difficulty: 'Difficoltà', country: 'Paese', price: 'Prezzo', date: 'Data', guide: 'Guida', members: 'Membri', notes: 'Note', send_sos: 'Invia SOS', book_now: 'Prenota ora', peak_detail: 'Dettaglio cima', booking_title: 'Prenota scalata' },
      es: { app_name: 'SummitLink', summit: 'Cima', search: 'Buscar', language: 'Idioma', home: 'Inicio', explore: 'Explorar', community: 'Comunidad', track: 'Ruta', gear: 'Equipo', me: 'Yo', booking: 'Reserva', submit: 'Enviar', cancel: 'Cancelar', close: 'Cerrar', save: 'Guardar', confirm: 'Confirmar', back: 'Atrás', edit: 'Editar', delete: 'Eliminar', share: 'Compartir', like: 'Me gusta', comment: 'Comentar', follow: 'Seguir', login: 'Iniciar sesión', logout: 'Cerrar sesión', settings: 'Configuración', sos: 'SOS Emergencia', loading: 'Cargando...', success: 'Éxito', error: 'Error', weather: 'Clima', altitude: 'Altitud', difficulty: 'Dificultad', country: 'País', price: 'Precio', date: 'Fecha', guide: 'Guía', members: 'Miembros', notes: 'Notas', send_sos: 'Enviar SOS', book_now: 'Reservar ahora', peak_detail: 'Detalle del pico', booking_title: 'Reservar escalada' },
    },
    t(key) {
      return this._i18nCache?.[this.lang]?.[key]
        || this._i18nCache?.['zh-CN']?.[key]
        || key;
    },
    getCurrentLangLabel() {
      if (this.lang === 'en') return 'English';
      if (this.lang === 'ne') return 'नेपाली';
      return '中文';
    },
    nearbyGuides: [],
    eightThousanders: [],
    continentalPeaks: [],
    worldPeaks: [],
    climbingSpots: [],
    categories: [
      { id: '8000ers', name: '八千米巨峰', icon: 'landscape' },
      { id: 'continental', name: '七大洲最高峰', icon: 'public' },
      { id: 'world', name: '世界经典', icon: 'travel_explore' },
      { id: 'alpine', name: '技术攀登', icon: 'terrain' },
      { id: 'commercial', name: '商业攀登', icon: 'groups' },
    ],
    _baseCategories: [
      { id: '8000ers', name: '八千米巨峰', icon: 'landscape' },
      { id: 'continental', name: '七大洲最高峰', icon: 'public' },
      { id: 'world', name: '世界经典', icon: 'travel_explore' },
      { id: 'alpine', name: '技术攀登', icon: 'terrain' },
      { id: 'commercial', name: '商业攀登', icon: 'groups' },
    ],
    commercialSourceTab: 'all',
    commercialSubFilter: 'all',
    communityPosts: [],
    climbDiaries: [],
    clubs: [],
    expeditions: [],
    guides: [],
    gearItems: [],
    guideArticles: [
      { id: 1, title: '8000米峰攀登基础知识', cover: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', author: '张磊', readTime: '15分钟', category: '高海拔' },
      { id: 2, title: '冰雪技术入门指南', cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', author: '李明', readTime: '10分钟', category: '技术' },
      { id: 3, title: '高海拔营养补给策略', cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', author: '王芳', readTime: '8分钟', category: '健康' },
    ],
    insuranceProducts: [
      { id: 1, name: '高山探险险', price: 2980, coverage: '300万', period: '30天', type: 'premium' },
      { id: 2, name: '标准登山险', price: 980, coverage: '100万', period: '14天', type: 'standard' },
      { id: 3, name: '基础户外险', price: 280, coverage: '30万', period: '7天', type: 'basic' },
    ],
    conversations: [
      { id: 1, name: '救援指挥中心', avatar: 'https://i.pravatar.cc/150?u=rescue', type: 'rescue', lastMsg: '您好，有紧急情况请立即联系', time: '10:30', unread: 0, messages: [] },
      { id: 2, name: '张磊（向导）', avatar: 'https://i.pravatar.cc/150?u=zhang', type: 'guide', lastMsg: '明天我们6点出发', time: '09:15', unread: 2, messages: [] },
      { id: 3, name: '珠峰2025队', avatar: 'https://i.pravatar.cc/150?u=team', type: 'team', lastMsg: '装备检查完毕', time: '昨天', unread: 5, messages: [] },
    ],
    tracks: [
      { id: 1, name: '珠峰大本营徒步', date: '2024-03-15', distance: 45.2, elevation: 2300, duration: '5天', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400' },
      { id: 2, name: 'K2 BC 线路', date: '2024-07-20', distance: 62.8, elevation: 3800, duration: '8天', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400' },
    ],
    teams: [
      { id: 1, name: '珠峰突击队2025', peak: '珠穆朗玛峰', date: '2025-05-01', level: '专业级', spots: 2, totalSpots: 6, leader: '张磊', leaderAvatar: 'https://i.pravatar.cc/150?u=zhang' },
      { id: 2, name: '马特洪峰探险团', peak: '马特洪峰', date: '2025-08-15', level: '中级', spots: 3, totalSpots: 4, leader: '李明', leaderAvatar: 'https://i.pravatar.cc/150?u=li' },
    ],
    emergencyContacts: [
      { name: '巅峰探索平台客服', number: '400-888-6699', country: '🏔️', tag: '默认', tagClass: 'bg-primary/20 text-primary-light' },
      { name: '中国登山救援', number: '12345', country: '🇨🇳' },
      { name: '尼泊尔山地救援', number: '+977-1-4231234', country: '🇳🇵' },
      { name: 'International SOS', number: '+86-10-6462-9100', country: '🌍' },
    ],
    // 用户保险信息 (Mock - 后端接口: GET /api/user/insurance 返回 {has_insurance, rescue_phone, insurer_name, policy_no})
    userInsurance: { has_insurance: true, rescue_phone: '400-999-1234', insurer_name: '太平洋山地险', policy_no: 'ALPS20250416' },
    // 新增状态
    showNewTrackModal: false,
    // Phase 2 - Track Recording state is kept initialized so dormant flows stay reactive.
    trackRecordingState: 'idle', // idle | recording | paused
    trackLiveStats: { distance: 0, elevation: 5364, seconds: 0 },
    trackTimer: null,
    newTrackName: '',
    publicTracks: [
      { id: 'p1', name: '珠峰BC徒步经典线路', author: '扎西旺堆', author_id: 'g1', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', distance_km: 52.3, elevation_gain: 2856, difficulty: '高', region: '喜马拉雅', likes: 234, date: '2025-03-20' },
      { id: 'p2', name: 'K2大本营穿越', author: 'Ang Dorji', author_id: 'g2', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', distance_km: 68.1, elevation_gain: 3920, difficulty: '极难', region: '喀喇昆仑', likes: 189, date: '2025-02-15' },
      { id: 'p3', name: '阿玛达布拉姆环线', author: 'Marc Dubois', author_id: 'g3', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', distance_km: 38.5, elevation_gain: 1950, difficulty: '中', region: '喜马拉雅', likes: 156, date: '2025-01-10' },
      { id: 'p4', name: '哈巴雪山标准路线', author: '李明', author_id: 'u2', image: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=400', distance_km: 24.2, elevation_gain: 1830, difficulty: '中', region: '横断山脉', likes: 98, date: '2025-04-01' },
      { id: 'p5', name: '慕士塔格峰正常路线', author: '王芳', author_id: 'u3', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', distance_km: 31.6, elevation_gain: 2480, difficulty: '高', region: '帕米尔', likes: 72, date: '2025-04-05' },
    ],
    filteredPublicTracks: [],
    publicTrackSearch: { query: '', difficulty: '' },
    showCommercialBooking: false,
    commercialBookingData: { peakName: '', difficulty: '', region: '', date: '', persons: 1, package: 'standard', notes: '', selectedClub: null, selectedGuide: null, routeId: null },
    commercialStep: 0,
    commercialRouteClubs: [],
    commercialClubsLoading: false,
    commercialClubGuides: [],
    commercialGuidesLoading: false,
    // Real commercial data from API
    commercialGuides: [],
    commercialClubs: [],
    commercialGuideExpeditions: [],
    commercialClubExpeditions: [],
    commercialDataLoaded: false,
    commercialPackages: [
      { id: 'basic', name: '基础套餐', desc: '向导费 + 营地支援', price: 25000 },
      { id: 'standard', name: '标准套餐', desc: '向导费 + 营地 + 高山厨师 + 氧气', price: 45000 },
      { id: 'premium', name: '全包套餐', desc: '标准套餐 + 私人协作 + 直升机保障', price: 80000 },
    ],
    showMyOrders: false,
    myOrdersFilter: '全部',
    myOrdersSubTab: 'expedition',
    myOrders: [],
    expeditionOrders: [],
    expeditionOrdersLoading: false,
    activityOrders: [],
    activityOrdersLoading: false,
    guideServiceOrders: [],
    guideServiceOrdersLoading: false,
    showActivityEnrollModal: false,
    enrollingActivity: null,
    enrollingClub: null,
    enrollForm: { emergency_contact_name: '', emergency_contact_phone: '', agreed_waiver: false, waiver_version: '1.0' },
    enrollLoading: false,
    currentGuideServices: [],
    guideServicesLoading: false,
    showGuideServiceEnrollModal: false,
    enrollingGuideService: null,
    enrollingGuideForService: null,
    guideServiceEnrollForm: { emergency_contact_name: '', emergency_contact_phone: '', agreed_waiver: false, waiver_version: '1.0', notes: '' },
    guideServiceEnrollLoading: false,
    showEnrollmentsDrawer: false,
    selectedActivityEnrollments: [],
    enrollmentsLoading: false,
    selectedActivityForEnrollments: null,
    myGuideServices: [],
    myGuideServicesLoading: false,
    showAddGuideService: false,
    newGuideService: { title: '', type: 'guided_climb', mountain: '', region: '', price: '', price_unit: 'per_day', duration_days: 1, max_clients: 8, difficulty: '', description: '' },
    showClubCommercialApply: false,
    clubCommercialApplyId: null,
    clubCommercialForm: { business_license_url: '', business_license_no: '', insurance_cert_url: '', bank_account_name: '', bank_account_no: '', bank_name: '' },
    clubCommercialLoading: false,
    showGuideCommercialApply: false,
    guideCommercialApplyId: null,
    guideCommercialForm: { id_card_url: '', climbing_cert_url: '', insurance_cert_url: '', health_cert_url: '' },
    guideCommercialLoading: false,
    showClubActivityMgmt: false,
    clubActivitiesMgmt: [],
    clubActivitiesMgmtLoading: false,
    teamDetailTab: 'info',
    teamChatInput: '',
    teamChatGroupId: null,
    teamChatMembers: [],
    teamChatMessages: [],
    navTabs: [
      { id: 'expedition', icon: 'explore', name: '首页' },
      { id: 'discover', icon: 'groups', name: '社区' },
      { id: 'chat', icon: 'chat_bubble', name: '消息' },
      { id: 'me', icon: 'person', name: '我的' },
    ],
    expeditionCards: [],
    weather: { location: '珠穆朗玛峰大本营', condition: 'partly_cloudy', temp: -8, wind: 25, humidity: 45, visibility: 12 },
    userProfile: { name: '山行者', username: '@summiteer', avatar: 'https://i.pravatar.cc/150?u=user1', level: '专业攀登者', summits: 12, expeditions: 8, followers: 1280, following: 340 },

    // Toast notifications
    showToast(message, type = 'info', duration = 3000) {
      const id = ++this._toastIdCounter;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, duration);
    },

    initErrorHandling() {
      if (this._errorHandlingInitialized || typeof window === 'undefined') return;
      this._errorHandlingInitialized = true;

      window.addEventListener('unhandledrejection', (e) => {
        console.error('[App] Unhandled rejection:', e.reason);
        const reasonMessage = String(e.reason?.message || '').toLowerCase();
        if (reasonMessage.includes('fetch') || e.reason?.name === 'NetworkError') {
          this.showToast('网络连接失败，请检查网络后重试', 'error');
        }
        if (typeof e.preventDefault === 'function') e.preventDefault();
      });

      window.addEventListener('error', (e) => {
        console.error('[App] Global error:', e.message, e.filename, e.lineno);
        if (
          e.message?.includes('Failed to fetch dynamically imported module')
          || e.message?.includes('Importing a module script failed')
        ) {
          this.showToast('功能模块加载失败，请刷新重试', 'error');
        }
      });
    },

    async initPerfMonitor() {
      if (this._perfMonitor || typeof PerformanceObserver === 'undefined') return;
      try {
        const { initPerfMonitor } = await import('./modules/perf.js');
        this._perfMonitor = initPerfMonitor({
          reportToApi: false,
          debug: location.hostname === 'localhost',
        });
      } catch (e) {}
    },

    // Search
    async globalSearch(query) {
      this.searchQuery = query;
      await this.performSearch();
    },
    async performSearch() {
      if (!this.searchQuery.trim()) { this.searchResults = []; return; }
      this.searchLoading = true;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(this.searchQuery)}&type=all&limit=20`, { headers: this.getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          this.searchResults = Array.isArray(data) ? data : (data.results || []);
        }
      } catch(e) {
        this.searchResults = [];
      } finally {
        this.searchLoading = false;
      }
    },
    selectSearchResult(result) {
      if (result.type === 'peak') this.openPeakDetail(result);
      else if (result.type === 'spot') this.openAlpineDetail(result);
      else if (result.type === 'guide') this.viewGuideProfile(result);
      else if (result.type === 'club') this.openClubDetail(result);
      else if (result.type === 'gear') this.openGearDetail(result);
      else if (result.type === 'post') {
        this.currentPage = 'discover';
        this.$nextTick(() => this.openPostDetail(result));
      }
      this.showSearch = false;
      this.searchQuery = '';
      this.searchResults = [];
    },
    searchByKeyword(keyword) { this.searchQuery = keyword; this.performSearch(); },
    removeHistory(index) { this.searchHistory.splice(index, 1); },
    async openPostDetail(post) {
      if (!post?.id) return;
      let targetPost = (this.communityPosts || []).find((item) => String(item.id) === String(post.id)) || post;
      try {
        const res = await fetch(`/api/posts/${post.id}`);
        if (res.ok) {
          const data = await res.json();
          targetPost = {
            ...targetPost,
            ...data,
            author: data.authorName || targetPost.author || targetPost.author_name,
            authorAvatar: data.authorAvatar || targetPost.authorAvatar || targetPost.author_avatar,
            timeAgo: data.createdAt ? new Date(data.createdAt).toLocaleDateString('zh-CN') : (targetPost.timeAgo || '最近'),
            isLiked: targetPost.isLiked || false,
            isFavorited: targetPost.isFavorited || false,
            commentPreview: targetPost.commentPreview || [],
          };
        }
      } catch (e) {}
      this.openComments(targetPost);
    },

    // Peak detail
    navigateToPeakDetail(peakName) {
      window.location.href = 'expedition-detail.html?peak=' + encodeURIComponent(peakName);
    },
    openPeakDetail(peak) {
      if (!peak) return;
      if (typeof peak === 'number' || (typeof peak === 'string' && /^\d+$/.test(peak))) {
        const peakId = Number(peak);
        const allPeaks = [
          ...(this.eightThousanders || []),
          ...(this.continentalPeaks || []),
          ...(this.worldPeaks || []),
          ...(this.climbingSpots || []),
        ];
        const found = allPeaks.find(p => Number(p.id) === peakId);
        if (found) return this.openPeakDetail(found);
        return;
      }
      this.destroyPeakLocationMap();
      this.selectedPeak = peak;
      this.showPeakDetail = true;
      this.peakWeather = null;
      this.peakForecast = [];
      this.peakCampWeathers = [];
      this.loadPeakWeather(peak);
      this.loadCampWeathers(peak);
      this.loadSummitWindow(peak.id || peak.name);
      this.$nextTick(async () => {
        if (peak && peak.latitude != null && peak.longitude != null) {
          const { renderPeakLocationMap } = await import('./map-core.js');
          renderPeakLocationMap('peak-location-map', peak.latitude, peak.longitude, peak.name, peak.altitude);
        }
      });
    },
    openWorldPeakDetail(peak) { this.openPeakDetail(peak); },
    openAlpineDetail(spot) { this.openPeakDetail(spot); },
    closePeakDetail() {
      this.destroyPeakLocationMap();
      this.showPeakDetail = false;
    },
    destroyPeakLocationMap() {
      const mapEl = document.getElementById('peak-location-map');
      if (!mapEl) return;
      if (mapEl._leafletMap) {
        try { mapEl._leafletMap.remove(); } catch (e) {}
        mapEl._leafletMap = null;
      }
      if (mapEl._peakLocationMap) {
        try {
          if (typeof mapEl._peakLocationMap.remove === 'function') mapEl._peakLocationMap.remove();
          else if (typeof mapEl._peakLocationMap.destroy === 'function') mapEl._peakLocationMap.destroy();
        } catch (e) {}
        mapEl._peakLocationMap = null;
      }
    },
    formatPeakCoordinates(peak) {
      if (!peak || peak.latitude == null || peak.longitude == null) return '';
      const lat = Math.abs(Number(peak.latitude)).toFixed(4);
      const lng = Math.abs(Number(peak.longitude)).toFixed(4);
      const latHemisphere = Number(peak.latitude) >= 0 ? 'N' : 'S';
      const lngHemisphere = Number(peak.longitude) >= 0 ? 'E' : 'W';
      return `${lat}°${latHemisphere}, ${lng}°${lngHemisphere}`;
    },
    async loadPeakWeather(peak) {
      if (!peak) return;
      this.peakWeatherLoading = true;
      try {
        const hasPeakId = peak && peak.id !== undefined && peak.id !== null && !Number.isNaN(Number(peak.id));
        const url = hasPeakId
          ? `/api/peaks/${Number(peak.id)}/weather`
          : `/api/weather?location=${encodeURIComponent(peak.name)}`;
        const res = await fetch(url);
        if (res.ok) this.peakWeather = await res.json();
      } catch(e) {}
      try {
        let furl;
        if (peak.latitude !== null && peak.latitude !== undefined && peak.longitude !== null && peak.longitude !== undefined) {
          furl = `/api/weather/forecast?lat=${peak.latitude}&lon=${peak.longitude}&location=${encodeURIComponent(peak.name)}`;
        } else {
          furl = `/api/weather/forecast?location=${encodeURIComponent(peak.name)}`;
        }
        const fres = await fetch(furl);
        if (fres.ok) {
          const fd = await fres.json();
          this.peakForecast = fd.forecast || [];
        }
      } catch(e) {}
      this.peakWeatherLoading = false;
    },
    async loadCampWeathers(peak) {
      if (!peak) return;
      this.peakCampWeathersLoading = true;
      this.peakCampWeathers = [];
      try {
        const res = await fetch(`/api/weather/camps?peak=${encodeURIComponent(peak.name)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.camps && data.camps.length > 0) {
            this.peakCampWeathers = this.markSameCampWeathers(data.camps);
          }
        }
      } catch(e) {}
      this.peakCampWeathersLoading = false;
    },
    // 标记相邻营地天气相同的情况
    markSameCampWeathers(camps) {
      for (let i = 1; i < camps.length; i++) {
        const prev = camps[i - 1];
        const curr = camps[i];
        if (prev.weather && curr.weather &&
            prev.weather.temp === curr.weather.temp &&
            prev.weather.wind === curr.weather.wind &&
            prev.weather.humidity === curr.weather.humidity) {
          curr.sameWeatherAsPrev = true;
        }
      }
      return camps;
    },
    // 获取过滤后的商业山峰列表
    getFilteredCommercialPeaks() {
      let peaks = this.commercialPeaks || [];
      if (this.commercialFilter.region) {
        peaks = peaks.filter(p => p.region === this.commercialFilter.region);
      }
      if (this.commercialFilter.difficulty) {
        peaks = peaks.filter(p => p.difficulty === this.commercialFilter.difficulty);
      }
      if (this.commercialFilter.sortBy === 'altitude') {
        peaks = [...peaks].sort((a, b) => b.altitude - a.altitude);
      } else if (this.commercialFilter.sortBy === 'annualClimbers') {
        peaks = [...peaks].sort((a, b) => b.annualClimbers - a.annualClimbers);
      } else if (this.commercialFilter.sortBy === 'difficulty') {
        const order = { '入门6000m': 1, '进阶7000m': 2, '技术型': 3, '8000m级': 4 };
        peaks = [...peaks].sort((a, b) => (order[b.difficulty] || 0) - (order[a.difficulty] || 0));
      }
      return peaks;
    },
    getCommercialGuideProducts() {
      // Prefer real guides loaded from API with expedition data
      if (this.commercialGuides && this.commercialGuides.length) {
        return this.commercialGuides;
      }
      const guides = this.guides.length ? this.guides : this.nearbyGuides;
      if (guides && guides.length) {
        return guides.map(g => ({
          ...g,
          languages: Array.isArray(g.languages) && g.languages.length ? g.languages : ['中文'],
          servicePeaks: Array.isArray(g.peaks_led) && g.peaks_led.length
            ? g.peaks_led.join('、')
            : (g.specialty || '多山峰定制服务'),
          priceLabel: (g.dayRate || g.price) ? `¥${Number(g.dayRate || g.price).toLocaleString()}/天` : '价格咨询',
        }));
      }
      // Static fallback demo data when no guides have been loaded from API
      return [
        { id: 'demo-g1', name: 'Alpine Ascents International', flag: '🇺🇸', verified: true, avatar: 'https://i.pravatar.cc/150?u=alpine_ascents', peaks_led: ['珠穆朗玛峰', 'K2', '马卡鲁峰'], specialty: '高海拔技术攀登', rating: 4.9, dayRate: 6800, languages: ['中文', '英文'] },
        { id: 'demo-g2', name: 'IMG Expeditions', flag: '🇺🇸', verified: true, avatar: 'https://i.pravatar.cc/150?u=img_exp', peaks_led: ['珠穆朗玛峰', '洛子峰', '马纳斯卢峰'], specialty: '远征攀登专家', rating: 4.8, dayRate: 5500, languages: ['中文', '英文', '法语'] },
        { id: 'demo-g3', name: 'Furtenbach Adventures', flag: '🇦🇹', verified: true, avatar: 'https://i.pravatar.cc/150?u=furtenbach', peaks_led: ['珠穆朗玛峰', '马纳斯卢峰', '卓奥友峰'], specialty: '轻量化高山向导', rating: 4.9, dayRate: 7200, languages: ['中文', '英文', '德语'] },
      ].map(g => ({
        ...g,
        languages: Array.isArray(g.languages) && g.languages.length ? g.languages : ['中文'],
        servicePeaks: Array.isArray(g.peaks_led) && g.peaks_led.length
          ? g.peaks_led.join('、')
          : (g.specialty || '多山峰定制服务'),
        priceLabel: (g.dayRate || g.price) ? `¥${Number(g.dayRate || g.price).toLocaleString()}/天` : '价格咨询',
      }));
    },
    getCommercialClubProducts() {
      // Prefer real clubs loaded from API with expedition data
      if (this.commercialClubs && this.commercialClubs.length) {
        return this.commercialClubs;
      }
      if (this.clubs && this.clubs.length) {
        return this.clubs.map(c => ({
          ...c,
          logo: c.logo || c.cover || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=200',
          climbPeak: c.specialty || '多条官方山峰路线',
          departureTime: c.next_departure || '近期出发',
          priceLabel: c.price ? `¥${Number(c.price).toLocaleString()}` : '价格咨询',
          quotaLabel: c.spots ? `${c.spots} 个名额` : '名额以活动页为准',
        }));
      }
      // Static fallback demo data when no clubs have been loaded from API
      return [
        { id: 'demo-c1', name: 'Seven Summit Treks', logo: 'https://i.pravatar.cc/150?u=seven_summit', specialty: '珠穆朗玛峰、K2、干城章嘉峰', next_departure: '2026年春季', price: 380000, spots: 8 },
        { id: 'demo-c2', name: 'Adventure Consultants', logo: 'https://i.pravatar.cc/150?u=adv_consult', specialty: '珠穆朗玛峰、阿玛达布拉姆峰', next_departure: '2026年秋季', price: 320000, spots: 6 },
        { id: 'demo-c3', name: 'Himalayan Experience', logo: 'https://i.pravatar.cc/150?u=himex', specialty: '珠穆朗玛峰、K2、马卡鲁峰', next_departure: '2026年春季', price: 290000, spots: 10 },
      ].map(c => ({
        ...c,
        logo: c.logo || c.cover || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=200',
        climbPeak: c.specialty || '多条官方山峰路线',
        departureTime: c.next_departure || '近期出发',
        priceLabel: c.price ? `¥${Number(c.price).toLocaleString()}` : '价格咨询',
        quotaLabel: c.spots ? `${c.spots} 个名额` : '名额以活动页为准',
      }));
    },
    // OpenStreetMap Nominatim 地名查询（带缓存和节流）
    async geocodeByOSM(name) {
      if (!name || !name.trim()) return null;
      const key = 'osm_geo_' + name.trim().toLowerCase().replace(/\s+/g, '_');
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const obj = JSON.parse(cached);
          if (Date.now() - obj.ts < 7 * 24 * 3600 * 1000) return obj;
        }
      } catch(e) {}
      const now = Date.now();
      if (now - this.osmLastRequestTime < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.osmLastRequestTime)));
      }
      this.osmLastRequestTime = Date.now();
      try {
        const q = encodeURIComponent(name.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1&email=gaoshanyindi%40github.example.com`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const first = data[0];
        const result = { lat: parseFloat(first.lat), lon: parseFloat(first.lon), displayName: first.display_name, raw: first, ts: Date.now() };
        try { localStorage.setItem(key, JSON.stringify(result)); } catch(e) {}
        return result;
      } catch(e) { return null; }
    },
    // 获取 Nominatim 候选列表（用于下拉）
    async fetchOsmSuggestions(name) {
      if (!name || name.trim().length < 2) { this.osmSuggestions = []; this.showOsmSuggestions = false; return; }
      const now = Date.now();
      if (now - this.osmLastRequestTime < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.osmLastRequestTime)));
      }
      this.osmLastRequestTime = Date.now();
      this.osmSuggestionsLoading = true;
      try {
        const q = encodeURIComponent(name.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1&email=gaoshanyindi%40github.example.com`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) { this.osmSuggestions = []; this.osmSuggestionsLoading = false; return; }
        const data = await res.json();
        this.osmSuggestions = data.map(item => ({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          displayName: item.display_name,
          raw: item,
        }));
        this.showOsmSuggestions = this.osmSuggestions.length > 0;
      } catch(e) {
        this.osmSuggestions = [];
      }
      this.osmSuggestionsLoading = false;
    },
    // 选择 Nominatim 候选项
    selectOsmSuggestion(suggestion) {
      this.weatherSearch = suggestion.displayName.split(',')[0].trim();
      this.showOsmSuggestions = false;
      this.osmSuggestions = [];
      this._searchWeatherByCoords(suggestion.lat, suggestion.lon, suggestion.displayName);
    },
    // 通过坐标查询天气
    async _searchWeatherByCoords(lat, lon, displayName) {
      this.weatherSearchLoading = true;
      this.weatherSearchResult = null;
      this.weatherSearchForecast = [];
      this.weatherSearchCamps = [];
      this.showWeatherSearchResult = true;
      try {
        const [wres, fres] = await Promise.all([
          fetch(`/api/weather?lat=${lat}&lon=${lon}&location=${encodeURIComponent(displayName)}`),
          fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
        ]);
        if (wres.ok) {
          this.weatherSearchResult = await wres.json();
        } else {
          this.weatherSearchResult = { error: '无法获取该地点天气', location: displayName };
        }
        if (fres.ok) {
          const fd = await fres.json();
          this.weatherSearchForecast = fd.forecast || [];
        }
      } catch(e) {
        this.weatherSearchResult = { error: '网络错误，请稍后重试' };
      }
      this.weatherSearchLoading = false;
    },
    async searchWeather() {
      if (!this.weatherSearch.trim()) return;
      this.weatherSearchLoading = true;
      this.weatherSearchResult = null;
      this.weatherSearchForecast = [];
      this.weatherSearchCamps = [];
      this.showWeatherSearchResult = true;
      const loc = this.weatherSearch.trim();
      const locEnc = encodeURIComponent(loc);
      try {
        // 先尝试获取营地分层天气（山峰名称匹配）
        const campsRes = await fetch(`/api/weather/camps?peak=${locEnc}`);
        if (campsRes.ok) {
          const campsData = await campsRes.json();
          if (campsData.camps && campsData.camps.length > 0) {
            this.weatherSearchCamps = this.markSameCampWeathers(campsData.camps);
            // 同时获取普通天气作为 header 显示
            try {
              const wres = await fetch(`/api/weather?location=${locEnc}`);
              if (wres.ok) this.weatherSearchResult = await wres.json();
              else this.weatherSearchResult = { location: loc, temp: '-', wind: '-', humidity: '-', visibility: '-' };
            } catch(e) {
              this.weatherSearchResult = { location: loc, temp: '-', wind: '-', humidity: '-', visibility: '-' };
            }
            this.weatherSearchLoading = false;
            return;
          }
        }
      } catch(e) {}
      // 普通地点天气查询
      try {
        const [wres, fres] = await Promise.all([
          fetch(`/api/weather?location=${locEnc}`),
          fetch(`/api/weather/forecast?location=${locEnc}`)
        ]);
        if (wres.ok) {
          this.weatherSearchResult = await wres.json();
        } else {
          const errData = await wres.json().catch(() => ({}));
          this.weatherSearchResult = { error: errData.error || '未找到该地点天气，请检查地名是否正确' };
        }
        if (fres.ok) {
          const fd = await fres.json();
          this.weatherSearchForecast = fd.forecast || [];
        }
      } catch(e) {
        this.weatherSearchResult = { error: '网络错误，请稍后重试' };
      }
      // OSM 地名解析回退：如果普通查询失败，尝试通过OSM获取坐标
      if (this.weatherSearchResult && this.weatherSearchResult.error) {
        const geo = await this.geocodeByOSM(loc);
        if (geo) {
          try {
            const [wres2, fres2] = await Promise.all([
              fetch(`/api/weather?lat=${geo.lat}&lon=${geo.lon}&location=${encodeURIComponent(geo.displayName)}`),
              fetch(`/api/weather/forecast?lat=${geo.lat}&lon=${geo.lon}`)
            ]);
            if (wres2.ok) this.weatherSearchResult = await wres2.json();
            if (fres2.ok) { const fd2 = await fres2.json(); this.weatherSearchForecast = fd2.forecast || []; }
          } catch(e) {}
        } else {
          this.weatherSearchResult = { error: '未找到该地点，请尝试使用英文名或更具体的名称（例如 "Mount Everest Base Camp, Nepal"）' };
        }
      }
      this.weatherSearchLoading = false;
    },

    // Booking
    openBooking(item) {
      this.bookingData.mountain = item.name || item;
      this.bookingData.coupon_id = null;
      this.selectedBookingCoupon = null;
      this.bookingCouponPreview = null;
      this.showBookingCouponPanel = false;
      this.showBooking = true;
      this.loadBookingCoupons();
    },
    openBookingWithGuide(peak, guide) {
      this.bookingData.mountain = peak.name;
      this.bookingData.guide = guide.name;
      this.bookingData.coupon_id = null;
      this.selectedBookingCoupon = null;
      this.bookingCouponPreview = null;
      this.showBookingCouponPanel = false;
      this.showBooking = true;
      this.loadBookingCoupons();
    },
    getBookingBaseAmount() {
      return 3000 * (this.bookingData.members || 1);
    },
    async loadBookingCoupons() {
      if (!this.authToken) { this.bookingAvailableCoupons = []; return; }
      try {
        const res = await fetch('/api/coupons/my?status=unused', { headers: this.getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const orderType = 'guide';
        this.bookingAvailableCoupons = (data.coupons || []).filter((coupon) => {
          const types = String(coupon.applicable_types || 'all').toLowerCase();
          if (!types || types === 'all') return true;
          return types.split(',').map((item) => item.trim()).includes(orderType);
        });
      } catch (e) {}
    },
    async selectBookingCoupon(coupon) {
      if (!coupon) {
        this.selectedBookingCoupon = null;
        this.bookingData.coupon_id = null;
        this.bookingCouponPreview = null;
        return;
      }
      const orderAmount = this.getBookingBaseAmount();
      try {
        const res = await fetch('/api/coupons/verify', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            code: coupon.code,
            order_type: 'guide',
            order_amount: orderAmount,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          this.showToast(data.error || data.message || '优惠券不可用', 'error');
          return;
        }
        this.selectedBookingCoupon = coupon;
        this.bookingData.coupon_id = data.couponId;
        this.bookingCouponPreview = data;
      } catch (e) {
        this.showToast('优惠券校验失败', 'error');
      }
    },
    async recalcBookingCoupon() {
      if (!this.selectedBookingCoupon) return;
      await this.selectBookingCoupon(this.selectedBookingCoupon);
    },
    async submitBooking() {
      if (!this.bookingData.date) { this.showToast('请选择出发日期', 'error'); return; }
      if (!this.requireAuth()) return;
      this.showBooking = false;
      const deposit = this.getBookingBaseAmount();
      const payAmount = this.bookingCouponPreview?.valid ? Number(this.bookingCouponPreview.finalAmount) : deposit;
      try {
        const body = {
          mountain: this.bookingData.mountain,
          guide_id: this.bookingData.guide_id || null,
          guide_name: this.bookingData.guide_name || (this.bookingData.guide ? (this.bookingData.guide.name || this.bookingData.guide) : ''),
          club_id: this.bookingData.club_id || null,
          club_name: this.bookingData.club_name || '',
          date: this.bookingData.date,
          members: this.bookingData.members || 1,
          notes: this.bookingData.notes || '',
          type: this.bookingData.club_id ? 'club' : 'guide',
          coupon_id: this.bookingData.coupon_id || null,
        };
        const res = await apiFetch('/api/bookings', { method: 'POST', body });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '预约未保存');
        }
        const booking = await res.json().catch(() => null);
        this.showToast('预约已提交，等待向导/俱乐部确认 🎉');
        if (this.bookingData.coupon_id) {
          try {
            await fetch('/api/coupons/use', {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({
                coupon_id: this.bookingData.coupon_id,
                order_type: 'guide',
                order_id: booking?.id || null,
              }),
            });
          } catch (e) {}
        }
        this.loadUnreadCount();
        this.openPayment(payAmount);
      } catch(e) { this.showToast('网络错误，预约未保存', 'error'); }
    },

    async toggleLike(post) {
      if (!this.requireAuth()) return;
      const wasLiked = post.isLiked;
      post.isLiked = !wasLiked;
      post.likes += post.isLiked ? 1 : -1;
      try {
        const res = await apiFetch('/api/posts/' + post.id + '/like', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          post.isLiked = data.liked;
          post.likes = data.likes;
        } else {
          post.isLiked = wasLiked;
          post.likes += wasLiked ? 1 : -1;
        }
      } catch(e) {
        post.isLiked = wasLiked;
        post.likes += wasLiked ? 1 : -1;
      }
    },
    toggleFavorite(post) { post.isFavorited = !post.isFavorited; },
    openComments(post) { this.selectedPostForComment = post; this.selectedPostComments = []; this.showComments = true; this.loadComments(post.id); },
    closeComments() { this.showComments = false; this.selectedPostForComment = null; },
    async addComment() {
      if (!this.newComment.trim() && this.commentImagePreviews.length === 0) return;
      if (!this.requireAuth()) return;
      const content = this.newComment.trim() || '';
      const imagePreviews = [...this.commentImagePreviews];
      this.newComment = '';
      this.commentImagePreviews = [];
      if (this.selectedPostForComment) {
        try {
          let imageUrls = imagePreviews;
          const blobImages = imagePreviews.filter(u => u.startsWith('blob:'));
          if (blobImages.length > 0) {
            imageUrls = await this.uploadImages(blobImages);
          }
          const res = await apiFetch('/api/comments', {
            method: 'POST',
            body: { post_id: this.selectedPostForComment.id, content: content || '', images: imageUrls },
          });
          const data = await res.json();
          if (res.ok) {
            this.selectedPostComments.push({ ...data, images: data.images || imageUrls });
            this.selectedPostForComment.comments++;
          } else { this.showToast(data.error || '评论失败', 'error'); }
        } catch(e) { this.showToast('网络错误', 'error'); }
      }
    },
    sharePost(post) { this.selectedPostForShare = post; this.showShare = true; },
    closeShareModal() { this.showShare = false; },
    doShare(platform) { this.showToast('已分享到 ' + platform); this.closeShareModal(); },
    copyShareLink() {
      const url = window.location.origin + '/summitlink';
      const text = this.selectedPostForShare ? this.selectedPostForShare.content : '来自巅峰探索 SummitLink';
      navigator.clipboard?.writeText(url).then(() => this.showToast('链接已复制')).catch(() => this.showToast('复制失败', 'error'));
    },
    shareToWeibo() {
      const url = encodeURIComponent(window.location.origin + '/summitlink');
      const text = encodeURIComponent((this.selectedPostForShare ? this.selectedPostForShare.content : '来自巅峰探索 SummitLink') + ' ' + window.location.origin + '/summitlink');
      window.open('https://service.weibo.com/share/share.php?url=' + url + '&title=' + text, '_blank');
      this.showShare = false;
    },
    shareToQQ() {
      const url = encodeURIComponent(window.location.origin + '/summitlink');
      const title = encodeURIComponent(this.selectedPostForShare ? this.selectedPostForShare.content.slice(0, 100) : '巅峰探索 SummitLink');
      window.open('https://connect.qq.com/widget/shareqq/index.html?url=' + url + '&title=' + title, '_blank');
      this.showShare = false;
    },

    // Post editor
    openPostEditor() { if (!this.requireAuth()) return; this.showPostEditor = true; },
    async submitPost() {
      if (!this.requireAuth()) return;
      if (!this.newPost.content.trim() && this.newPost.images.length === 0 && !this.newPost.videoFile) return;
      try {
        // 上传视频（若有）
        let videoUrl = this.newPost.videoUrl || null;
        if (this.newPost.videoFile && !videoUrl) {
          const fd = new FormData();
          fd.append('file', this.newPost.videoFile);
          const vr = await fetch('/api/upload/video', { method: 'POST', headers: { Authorization: 'Bearer ' + this.authToken }, body: fd });
          if (vr.ok) { const vd = await vr.json(); videoUrl = vd.url; }
        }
        // 上传图片（blob URLs → 服务器 URLs）
        let imageUrls = this.newPost.images;
        const blobImages = imageUrls.filter(u => u.startsWith('blob:'));
        if (blobImages.length > 0) {
          const uploaded = await this.uploadImages(blobImages);
          imageUrls = [...imageUrls.filter(u => !u.startsWith('blob:')), ...uploaded];
        }
        const res = await apiFetch('/api/posts', {
          method: 'POST',
          body: { content: this.newPost.content, location: this.newPost.location, images: imageUrls, image: imageUrls[0] || null, video_url: videoUrl, category: this.newPost.category || 'post' },
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '发布失败', 'error'); return; }
        this.communityPosts.unshift({ ...data, author: data.authorName, timeAgo: '刚刚', isLiked: false, isFavorited: false, commentPreview: [] });
      } catch(e) {
        const imageUrls = this.newPost.images;
        this.communityPosts.unshift({ id: Date.now(), author: this.userProfile.name, authorAvatar: this.userProfile.avatar, timeAgo: '刚刚', content: this.newPost.content, image: imageUrls[0] || null, images: imageUrls, location: this.newPost.location || '', category: this.newPost.category || 'post', likes: 0, comments: 0, isLiked: false, isFavorited: false, commentPreview: [] });
      }
      this.newPost = { content: '', location: '', images: [], videoPreview: '', videoFile: null, videoUrl: '', category: 'post' };
      this.showPostEditor = false;
      this.showToast('发布成功！');
    },
    addPostImage() { this.newPost.images.push('https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400'); },
    removePostImage(idx) { this.newPost.images.splice(idx, 1); },
    selectPostEmoji(emoji) { this.newPost.content += emoji; },
    togglePostEmojiPicker() { this.showPostEmojiPicker = !this.showPostEmojiPicker; },

    // Chat
    selectEmoji(emoji) { this.chatInput += emoji; },
    sendMessage() {
      if (!this.chatInput.trim()) return;
      if (this.selectedConversation) {
        this.selectedConversation.messages = this.selectedConversation.messages || [];
        this.selectedConversation.messages.push({ from: 'me', text: this.chatInput, time: new Date().toLocaleTimeString() });
      }
      this.chatInput = '';
    },
    openChatDetail(conv) { this.selectedConversation = conv; this.showChatDetail = true; },
    async openChatWithUser(name, avatar, userId) {
      const requestToken = Symbol('openChatWithUser');
      this._openChatWithUserRequestToken = requestToken;
      const session = { id: Date.now(), name, avatar, flag: '', type: 'guide', online: false, unread: 0, lastMsg: '', messages: [], conversationId: null };
      this.currentPage = 'chat';
      await this.openChatSession(session);
      if (userId && this.authToken) {
        try {
          const res = await fetch('/api/messages/conversations', {
            method: 'POST', headers: this.getAuthHeaders(),
            body: JSON.stringify({ target_user_id: userId }),
          });
          if (res.ok) {
            const conv = await res.json();
            if (this._openChatWithUserRequestToken !== requestToken || this.activeChatSession !== session) return;
            let existingSession = this.chatSessions.find((s) => Number(s.conversationId) === Number(conv.id));
            if (!existingSession) {
              this.chatSessions = this.chatSessions.filter((s) => s.id !== session.id);
              existingSession = { ...session, id: conv.id, conversationId: conv.id };
              this.chatSessions.unshift(existingSession);
            }
            await this.openChatSession(existingSession);
          }
        } catch(e) {}
      }
    },
    get filteredConversations() {
      if (!this.activeChatType || this.activeChatType === 'all') return this.conversations;
      return this.conversations.filter(c => c.type === this.activeChatType);
    },

    // Guides
    viewGuideProfile(guide) { this.selectedGuide = guide; this.showGuideDetail = true; },
    contactGuide(guide) { this.openChatWithUser(guide.name, guide.avatar, guide.userId || guide.user_id); },
    bookGuideService(guide) {
      if (!this.requireAuth()) return;
      this.bookingData.mountain = guide.specialty ? guide.specialty.split('/')[0].trim() : '';
      this.bookingData.guide = guide.name;
      this.bookingData.coupon_id = null;
      this.selectedBookingCoupon = null;
      this.bookingCouponPreview = null;
      this.showBookingCouponPanel = false;
      this.showBooking = true;
      this.loadBookingCoupons();
    },
    selectGuideDate(date) { this.bookingData.date = date; },
    isGuideDateAvailable(date) { return true; },

    // SOS
    openSOS() {
      if (this._sosStatusTimer) clearInterval(this._sosStatusTimer);
      if (this._sosStatusCountdownTimer) clearInterval(this._sosStatusCountdownTimer);
      this._sosStatusTimer = null;
      this._sosStatusCountdownTimer = null;
      this.showSOS = true;
      this.sosStep = 0;
      this.sosLocation = null;
      this.sosLocationError = null;
      this.sosLoading = false;
      this.sosStatus = 'pending';
      this.sosId = null;
      this.sosSentAt = null;
      this.sosPeakName = '';
      this.sosMessage = '';
      this.refreshLocation();
      this.loadSosHistory();
    },
    cancelSOS() {
      this.sosImages.forEach(url => URL.revokeObjectURL(url));
      this.sosImages = [];
      this.closeSOSPanel();
      this.cancelSOSCountdown(false);
    },
    async refreshLocation() {
      this.sosLocationError = null;
      if (!navigator.geolocation) {
        this.sosLocationError = '您的设备不支持 GPS 定位';
        return;
      }
      this.sosLocationLoading = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, altitude, accuracy } = pos.coords;
          this.sosLocation = { lat, lng, altitude, accuracy };
          if (altitude === null || altitude === undefined) {
            try {
              const r = await fetch(`/api/altitude?lat=${lat}&lng=${lng}`);
              if (r.ok) {
                const d = await r.json();
                this.sosLocation = { ...this.sosLocation, altitude: d.altitude };
              }
            } catch (_) {}
          }
          this.sosLocationLoading = false;
        },
        () => {
          this.sosLocationError = '无法获取位置，请检查位置权限';
          this.sosLocationLoading = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },
    async shareLocation() {
      if (!this.sosLocation) {
        this.showToast('请先获取位置', 'error');
        return;
      }
      const { lat, lng, altitude } = this.sosLocation;
      const text = `我的位置：https://maps.google.com/?q=${lat},${lng}${altitude ? `\n海拔：${Math.round(altitude)}m` : ''}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'SummitLink 位置分享', text });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          this.showToast('位置链接已复制到剪贴板');
        } else {
          this.showToast(text, 'info');
        }
      } catch (_) {}
    },
    callEmergency(number) {
      if (!number) return;
      window.location.href = `tel:${String(number).replace(/[^\d+]/g, '')}`;
      this.showToast('正在拨打 ' + number);
    },
    callContact(contact) { this.showToast('正在联系 ' + contact.name); },
    callVIPHotline() { this.showToast('正在拨打 VIP 热线'); },
    saveMedicalInfo() { this.showToast('医疗信息已保存'); },
    handleSOSImageUpload(event) {
      const files = event.target.files;
      if (files) {
        Array.from(files).forEach(f => {
          if (!f.type.startsWith('image/')) return;
          if (f.size > 10 * 1024 * 1024) { this.showToast('图片大小不能超过10MB', 'error'); return; }
          this.sosImages.push(URL.createObjectURL(f));
        });
      }
    },

    // Insurance (legacy helpers)
    buyInsurance(type) { this.showToast('已选择保险方案：' + type); },
    purchaseInsurance(product) { this.showToast('购买成功：' + product.name); this.showInsurance = false; },
    fileInsuranceClaim() { this.showToast('理赔申请已提交'); },
    bookVIPService() { this.showToast('VIP 服务预约成功'); },

    // Expeditions & Clubs
    openClubDetail(club) { this.selectedClub = club; this.showClubDetail = true; },
    async joinClub() {
      if (!this.requireAuth()) return;
      if (!this.selectedClub) return;
      try {
        const res = await fetch('/api/clubs/' + this.selectedClub.id + '/join', { method: 'POST', headers: this.getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
          this.showToast('已成功加入俱乐部！');
          if (this.selectedClub) this.selectedClub.members = (this.selectedClub.members || 0) + 1;
        } else { this.showToast(data.error || '加入失败', 'error'); }
      } catch(e) { this.showToast('加入失败，请重试', 'error'); }
      this.showClubDetail = false;
    },
    openArticle(guide) { this.selectedArticle = guide; this.showArticle = true; },

    // Gear
    openGearDetail(item) { this.selectedGear = item; this.showGearDetail = true; },
    openGearPublish() { this.showGearPublish = true; },
    async uploadGearImage(event) {
      const file = event.target.files[0];
      if (!file) return;
      const { valid, error } = validateImageFile(file);
      if (!valid) { alert(error); event.target.value = ''; return; }
      this.gearImageUploading = true;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          this.newGear.images.push(data.url);
        } else {
          this.showToast('图片上传失败', 'error');
        }
      } catch(e) { this.showToast('上传失败', 'error'); }
      this.gearImageUploading = false;
      event.target.value = '';
    },
    async uploadAvatar(event) {
      let file = event && event.target && event.target.files ? event.target.files[0] : null;
      if (!file && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        try {
          const Camera = window.Capacitor?.Plugins?.Camera;
          if (Camera) {
            const photo = await Camera.getPhoto({
              source: 'PROMPT',
              quality: 80,
              resultType: 'base64',
            });
            if (photo && photo.base64String) {
              const mime = photo.format === 'png' ? 'image/png' : 'image/jpeg';
              const bytes = atob(photo.base64String);
              const arr = new Uint8Array(bytes.length);
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
              file = new File([arr], `avatar.${photo.format || 'jpg'}`, { type: mime });
            }
          }
        } catch (e) {}
      }
      if (!file) return;
      const { valid, error } = validateImageFile(file);
      if (!valid) {
        alert(error);
        if (event && event.target) event.target.value = '';
        return;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/users/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.authToken}` },
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          this.userProfile.avatar = data.url;
          this.showToast('头像更新成功 ✅');
        } else {
          this.showToast(data.error || '头像上传失败', 'error');
        }
      } catch(e) { this.showToast('头像上传失败', 'error'); }
      if (event && event.target) event.target.value = '';
    },
    triggerAvatarUpload() {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        this.uploadAvatar();
        return;
      }
      if (this.$refs.avatarInput) this.$refs.avatarInput.click();
    },
    async submitGear() {
      if (!this.requireAuth()) return;
      if (!this.newGear.name || !this.newGear.price) { this.showToast('请填写装备名称和价格', 'error'); return; }
      try {
        const payload = {
          ...this.newGear,
          price: Number(this.newGear.price),
          mode: 'used',
          image: this.newGear.images && this.newGear.images.length > 0 ? this.newGear.images[0] : null,
          images: JSON.stringify(this.newGear.images || []),
        };
        const res = await fetch('/api/gear', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '发布失败', 'error'); return; }
        this.gearItems.unshift({ ...data, sellerAvatar: this.userProfile.avatar, seller: this.userProfile.name });
        this.showToast('装备已发布！');
        this.newGear = { name: '', brand: '', price: '', condition: 'good', description: '', images: [] };
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
      this.showGearPublish = false;
    },
    contactSeller(item) { this.openChatWithUser(item.seller || '卖家', item.sellerAvatar || '', item.seller_id); },
    getConditionClass(condition) {
      const map = { '全新': 'text-green-400', '九成新': 'text-emerald-400', '八成新': 'text-yellow-400', '七成新': 'text-orange-400' };
      return map[condition] || 'text-slate-400';
    },

    async joinTeam(team) {
      if (!this.requireAuth()) { this.closeTeamDetail(); return; }
      try {
        const res = await fetch('/api/teams/' + team.id + '/join', { method: 'POST', headers: this.getAuthHeaders() });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '申请失败', 'error'); return; }
        this.showToast('已申请加入：' + team.name + ' 🎉');
        team.spots = Math.max(0, team.spots - 1);
      } catch(e) { this.showToast('申请失败，请重试', 'error'); }
      this.closeTeamDetail();
    },
    openTeamDetail(team) {
      if (this.selectedTeam?.id && this._locationSocket && this.selectedTeam.id !== team?.id) {
        this._locationSocket.emit('leave-expedition', this.selectedTeam.id);
      }
      this.teamDetailTab = 'info';
      this.selectedTeam = team;
      this.showTeamDetail = true;
      this.initExpeditionMap(team && team.id ? team.id : null);
    },
    closeTeamDetail() {
      if (this.selectedTeam?.id && this._locationSocket) {
        this._locationSocket.emit('leave-expedition', this.selectedTeam.id);
      }
      this.stopExpeditionLocationPolling();
      this.locationConnectionMode = 'none';
      this.showTeamDetail = false;
      this.teamDetailTab = 'info';
      if (this._teamChatPollTimer) { clearInterval(this._teamChatPollTimer); this._teamChatPollTimer = null; }
    },
    initExpeditionMap(expeditionId) {
      this.initLocationSocket(expeditionId);
    },
    locationStatusColorClass() {
      if (this.locationConnectionMode === 'ws') return 'bg-emerald-400';
      if (this.locationConnectionMode === 'poll') return 'bg-amber-400';
      return 'bg-red-500';
    },
    locationStatusText() {
      if (this.locationConnectionMode === 'ws') return 'WS 连接';
      if (this.locationConnectionMode === 'poll') return 'HTTP 轮询';
      return '未连接';
    },
    stopExpeditionLocationPolling() {
      if (this._locationPollTimer) {
        clearInterval(this._locationPollTimer);
        this._locationPollTimer = null;
      }
    },
    startExpeditionLocationPolling(expeditionId) {
      if (!expeditionId || !this.authToken) {
        this.locationConnectionMode = 'none';
        return;
      }
      this.stopExpeditionLocationPolling();
      this.locationConnectionMode = 'poll';
      this.loadExpeditionLocations(expeditionId);
      this._locationPollTimer = setInterval(() => {
        this.loadExpeditionLocations(expeditionId);
      }, this.expeditionLocationPollMs);
    },
    async loadExpeditionLocations(expeditionId) {
      if (!expeditionId || !this.authToken) return;
      try {
        const res = await fetch(`/api/location/team?expeditionId=${encodeURIComponent(expeditionId)}`, {
          headers: this.getAuthHeaders(),
        });
        if (!res.ok) return;
        const members = await res.json();
        if (Array.isArray(members)) this.teamMembers = members;
      } catch (e) {
        console.warn('[location] loadExpeditionLocations failed:', e && e.message ? e.message : e);
      }
    },
    openCreateTeam() { this.showCreateTeam = true; },
    closeCreateTeam() { this.showCreateTeam = false; },
    async createTeam() {
      if (!this.requireAuth()) return;
      if (!this.newTeam.name || !this.newTeam.peak) { this.showToast('请填写队伍名称和目标山峰', 'error'); return; }
      try {
        const res = await fetch('/api/teams', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ name: this.newTeam.name, peak: this.newTeam.peak, date: this.newTeam.date, totalSpots: Number(this.newTeam.spots), level: this.newTeam.level, description: this.newTeam.description }) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '创建失败', 'error'); return; }
        this.teams.unshift({ ...data, leaderAvatar: this.userProfile.avatar });
        this.showToast('队伍创建成功！');
        this.newTeam = { name: '', peak: '', date: '', level: '', spots: 4, description: '' };
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
      this.closeCreateTeam();
    },

    async ensureMapCore() {
      if (this._mapCore) return this._mapCore;
      if (!this._mapCoreLoading) {
        this._mapCoreLoading = import('/www/js/map-core.js')
          .then((mod) => {
            this._mapCore = mod;
            return mod;
          })
          .catch((e) => {
            console.warn('[map] map-core lazy load failed:', e && e.message ? e.message : e);
            return null;
          });
      }
      return this._mapCoreLoading;
    },

    initAMap(containerId, options = {}) {
      if (this._mapCore?.initAMap) return this._mapCore.initAMap(containerId, options);
      if (typeof AMap === 'undefined') return null;
      const defaultOptions = { zoom: 13, center: [116.397428, 39.90923], mapStyle: 'amap://styles/dark' };
      try {
        return new AMap.Map(containerId, { ...defaultOptions, ...options });
      } catch(e) { return null; }
    },

    async initMap(containerId, options = {}) {
      const mapCore = await this.ensureMapCore();
      if (mapCore?.initMap) return mapCore.initMap.call(this, containerId, options);
      return this.initAMap(containerId, options);
    },

    drawTrackOnMap(map, points) {
      if (this._mapCore?.drawTrackOnMap) return this._mapCore.drawTrackOnMap.call(this, map, points);
      if (!map || !points || points.length < 2) return;
    },

    // Phase 2.3: 同步待上传轨迹（重试最多3次）
    async syncPendingTracks() {
      if (!this.authToken) return;
      let pending;
      try { pending = await idbGetPendingTracks(); } catch(e) { console.warn('[IDB] 读取待上传轨迹失败', e); return; }
      for (const track of pending) {
        if (track.retries >= 3) {
          await idbUpdateTrackStatus(track.id, 'failed', track.retries).catch(e => console.warn('[IDB] 更新状态失败', e));
          continue;
        }
        await idbUpdateTrackStatus(track.id, 'uploading', track.retries).catch(e => console.warn('[IDB] 更新状态失败', e));
        try {
          const res = await apiFetch('/api/tracks', {
            method: 'POST',
            body: { name: track.name, points: track.points, distance: 0, elevation_gain: 0, duration: '00:00' },
          });
          if (res.ok) {
            await idbDeletePendingTrack(track.id).catch(e => console.warn('[IDB] 删除记录失败', e));
          } else {
            await idbUpdateTrackStatus(track.id, 'failed', track.retries + 1).catch(e => console.warn('[IDB] 更新状态失败', e));
          }
        } catch(e) {
          await idbUpdateTrackStatus(track.id, 'pending', track.retries + 1).catch(err => console.warn('[IDB] 更新状态失败', err));
        }
      }
      this.pendingUploadCount = await idbGetPendingTracks().then(t => t.length).catch(() => 0);
      if (this.pendingUploadCount === 0 && pending.length > 0) {
        this.showToast('待上传轨迹已全部同步成功 ✅');
      }
    },

    /*
    Phase 2 - Track Recording
    // 初始化轨迹记录地图（懒加载 map-core）
    initTrackMap() {
      if (this._mapCore?.initTrackMap) return this._mapCore.initTrackMap.call(this);
      return this.ensureMapCore().then((mod) => mod?.initTrackMap && mod.initTrackMap.call(this));
    },

    applyTrackMapLayer(layerKey) {
      if (this._mapCore?.applyTrackMapLayer) return this._mapCore.applyTrackMapLayer.call(this, layerKey);
      return this.ensureMapCore().then((mod) => mod?.applyTrackMapLayer && mod.applyTrackMapLayer.call(this, layerKey));
    },

    switchTrackMapLayer(layerKey) {
      if (this._mapCore?.switchTrackMapLayer) return this._mapCore.switchTrackMapLayer.call(this, layerKey);
      this.applyTrackMapLayer(layerKey);
      this.showTrackLayerPanel = false;
    },
    */
    // Phase 2 stub: keep dormant track entrypoints callable so legacy click paths fail safely.
    initTrackMap() {},
    applyTrackMapLayer() {},
    switchTrackMapLayer() {},

    getPageTitle() {
      const tab = this.resolvePrimaryTab(this.currentPage);
      const titleMap = {
        expedition: this.t('nav_expedition'),
        discover: this.t('nav_explore'),
        chat: this.t('nav_messages'),
        me: this.t('nav_me'),
      };
      return titleMap[tab] || '探索与协作';
    },

    resolvePrimaryTab(page) {
      if (page === 'me') return 'me';
      if (page === 'chat') return 'chat';
      if (['community', 'explore'].includes(page)) return 'discover';
      return 'expedition';
    },

    isGuideUser() {
      const user = this.currentUser;
      return !!(user && (
        user.role === 'guide' ||
        user.is_guide ||
        user.guide ||
        user.guide_profile ||
        user.guide_id ||
        user.guideId
      ));
    },

    isClubUser() {
      const user = this.currentUser;
      return !!(user && (
        user.role === 'club_admin' ||
        user.role === 'club' ||
        user.is_club_admin ||
        user.club ||
        user.club_profile ||
        user.club_id ||
        user.clubId
      ));
    },

    isPersonalUser() {
      return !!this.currentUser && !this.isGuideUser() && !this.isClubUser();
    },

    getCurrentGuideId() {
      return this.currentUser?.guide?.id
        || this.currentUser?.guide_id
        || this.currentUser?.guideId
        || this.currentUser?.guide_profile?.id
        || this.currentUser?.guide_profile_id
        || this.currentGuideProfile?.id
        || null;
    },

    getCurrentClubId() {
      return this.currentUser?.club?.id
        || this.currentUser?.club_id
        || this.currentUser?.clubId
        || this.currentUser?.club_profile?.id
        || this.currentUser?.club_profile_id
        || this.currentClubProfile?.id
        || null;
    },

    isPrimaryTabActive(tabId) {
      return this.resolvePrimaryTab(this.currentPage) === tabId;
    },

    switchPrimaryTab(tabId) {
      const pageMap = {
        expedition: 'home',
        discover: 'community',
        explore: 'explore',
        chat: 'chat',
        me: 'me',
      };
      this.closeWechatPay();
      this.closeStripePay();
      this.showAlipayConfirm = false;
      this.currentPage = pageMap[tabId] || 'home';
    },

    async ensureWeatherModule() {
      if (this._weatherModuleLoaded) return true;
      if (!this._weatherModuleLoading) {
        this._weatherModuleLoading = import('./modules/weather.js')
          .then((mod) => {
            mod.registerWeatherModule(this);
            this._weatherModuleLoaded = true;
            return true;
          })
          .catch((e) => {
            console.warn('[module] weather load failed:', e && e.message ? e.message : e);
            this._weatherModuleFailed = true;
            return false;
          });
      }
      return this._weatherModuleLoading;
    },

    async ensureCommercialModule() {
      if (this._commercialModuleLoaded) return true;
      if (!this._commercialModuleLoading) {
        this._commercialModuleLoading = import('./modules/commercial.js')
          .then((mod) => {
            mod.registerCommercialModule(this);
            this._commercialModuleLoaded = true;
            return true;
          })
          .catch((e) => {
            console.warn('[module] commercial load failed:', e && e.message ? e.message : e);
            this._commercialModuleFailed = true;
            return false;
          });
      }
      return this._commercialModuleLoading;
    },

    async ensureCommunityModule() {
      if (this._communityModuleLoaded) return true;
      if (!this._communityModuleLoading) {
        this._communityModuleLoading = import('./modules/community.js')
          .then((mod) => {
            mod.registerCommunityModule(this);
            this._communityModuleLoaded = true;
            return true;
          })
          .catch((e) => {
            console.warn('[module] community load failed:', e && e.message ? e.message : e);
            this._communityModuleFailed = true;
            return false;
          });
      }
      return this._communityModuleLoading;
    },

    async handleTabClick(tabId) {
      if (tabId === 'me' && !this.currentUser) {
        this.showLogin = true;
        return;
      }
      this.switchPrimaryTab(tabId);
      if (tabId === 'explore' || tabId === 'discover') {
        await this.ensureWeatherModule();
        await this.ensureCommercialModule();
        if (this._weatherModuleFailed || this._commercialModuleFailed) {
          this.showToast('部分功能加载失败，请刷新页面重试', 'warning');
          this._weatherModuleFailed = false;
          this._commercialModuleFailed = false;
        }
      }
      if (tabId === 'discover') {
        await this.ensureCommunityModule();
        if (this._communityModuleFailed) {
          this.showToast('社区功能加载失败，请刷新页面重试', 'warning');
          this._communityModuleFailed = false;
        }
        if (typeof this.loadPosts === 'function' && this.communityPosts.length === 0) {
          this.loadPosts().then(() => { this.filteredCommunityPosts = this.communityPosts; });
        }
      }
      if (tabId === 'me' && this.currentUser) {
        this.loadMyOrders();
      }
    },
    isGuideApproved() {
      const guideStatus = this.currentUser && this.currentUser.guide_status;
      return !!(this.currentUser && (this.currentUser.is_guide || (typeof guideStatus === 'string' && guideStatus.startsWith('approved'))));
    },
    isClubAdminUser() {
      return !!(this.currentUser && (this.currentUser.is_club_admin || this.currentUser.club_id));
    },
    shouldShowGuideApplyEntry() {
      return !!(this.currentUser && this.currentUser.guide_status !== 'pending' && !this.isGuideApproved() && !this.isClubAdminUser());
    },

    async openExpeditionDetail(item) {
      if (!item) {
        this.showToast('探险详情暂不可用', 'warning');
        return;
      }
      this.selectedExpedition = item;
      this.showExpeditionDetail = true;
      if (!item.id) return;
      try {
        const res = await fetch(`/api/expeditions/${encodeURIComponent(item.id)}`);
        if (res.ok) this.selectedExpedition = await res.json();
      } catch (e) {}
    },

    toggleMapSearch() {
      this.mapSearchExpanded = !this.mapSearchExpanded;
      if (!this.mapSearchExpanded) this.mapSearchQuery = '';
    },

    runMapSearch() {
      const keyword = String(this.mapSearchQuery || '').trim();
      if (!keyword) {
        this.showToast('请输入山峰或营地名称', 'warning');
        return;
      }
      this.weatherSearch = keyword;
      this.showOsmSuggestions = false;
      this.searchWeather();
      this.showToast(`已搜索：${keyword}`);
    },

    startOfflineMapDownload() {
      this.showOfflineMapModal = true;
      this.offlineMapProgress = 0;
    },

    closeOfflineMapModal() {
      this.showOfflineMapModal = false;
      this.offlineMapProgress = 0;
    },

    /*
    Phase 2 - Track Recording
    // GPS 定位（懒加载 map-core）
    locateMe() {
      if (this._mapCore?.locateMe) return this._mapCore.locateMe.call(this);
      return this.ensureMapCore().then((mod) => mod?.locateMe && mod.locateMe.call(this));
    },

    locateRecordingMap() {
      if (this._mapCore?.locateRecordingMap) return this._mapCore.locateRecordingMap.call(this);
      return this.ensureMapCore().then((mod) => mod?.locateRecordingMap && mod.locateRecordingMap.call(this));
    },

    renderTrackDetailMap(track) {
      if (this._mapCore?.renderTrackDetailMap) return this._mapCore.renderTrackDetailMap.call(this, track);
      return this.ensureMapCore().then((mod) => mod?.renderTrackDetailMap && mod.renderTrackDetailMap.call(this, track));
    },
    */
    // Phase 2 stub: keep dormant track entrypoints callable so legacy click paths fail safely.
    locateMe() {},
    locateRecordingMap() {},
    renderTrackDetailMap() {},

    // Track Recording with AMap
    async importGpxFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (!this.requireAuth()) return;
      try {
        const text = await file.text();
        let points = [];
        if (file.name.toLowerCase().endsWith('.gpx')) {
          // Parse GPX
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'application/xml');
          const trkpts = doc.querySelectorAll('trkpt');
          const baseTs = Date.now();
          trkpts.forEach((pt, idx) => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lng = parseFloat(pt.getAttribute('lon'));
            const eleEl = pt.querySelector('ele');
            const timeEl = pt.querySelector('time');
            const ele = eleEl ? parseFloat(eleEl.textContent) : 0;
            const ts = timeEl ? new Date(timeEl.textContent).getTime() : baseTs + idx * 1000;
            if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng, ele, ts });
          });
        } else if (file.name.toLowerCase().endsWith('.kml')) {
          // Parse KML coordinates
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'application/xml');
          const coordsEl = doc.querySelector('coordinates');
          if (coordsEl) {
            const coordStr = coordsEl.textContent.trim();
            const kmlBaseTs = Date.now();
            coordStr.split(/\s+/).forEach((c, idx) => {
              const parts = c.split(',');
              if (parts.length >= 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                const ele = parts[2] ? parseFloat(parts[2]) : 0;
                if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng, ele, ts: kmlBaseTs + idx * 1000 });
              }
            });
          }
        }
        if (points.length < 2) { this.showToast('轨迹文件需要至少2个有效坐标点，请检查文件格式', 'error'); return; }
        // Calculate stats
        let totalDist = 0;
        let elevGain = 0;
        let maxEle = points[0].ele || 0;
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i-1], p2 = points[i];
          const R = 6371;
          const dLat = (p2.lat - p1.lat) * Math.PI / 180;
          const dLon = (p2.lng - p1.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
          totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (p2.ele > p1.ele) elevGain += p2.ele - p1.ele;
          if (p2.ele > maxEle) maxEle = p2.ele;
        }
        const trackName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const body = {
          name: trackName,
          date: new Date().toISOString().slice(0, 10),
          distance_km: Math.round(totalDist * 100) / 100,
          elevation_gain: Math.round(elevGain),
          max_elevation: Math.round(maxEle),
          points,
        };
        const res = await fetch('/api/tracks/import-gpx', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
          this.showToast('GPX轨迹导入成功！共 ' + points.length + ' 个轨迹点 📍');
          this.loadTracks();
          event.target.value = '';
        } else { this.showToast(data.error || '导入失败', 'error'); }
      } catch(e) { this.showToast('文件解析失败：' + e.message, 'error'); event.target.value = ''; }
    },
    startTrackRecording() {
      this.initTrackMap();
      this.trackRecordingState = 'recording';
      this.trackRecordedPoints = [];
      this._amapPolyline = null;
      if (navigator.geolocation) {
        this._geoWatch = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, altitude } = pos.coords;
            const lat = parseFloat(latitude.toFixed(6));
            const lng = parseFloat(longitude.toFixed(6));
            const ele = altitude != null ? parseFloat(altitude.toFixed(1)) : 0;
            this.trackRecordedPoints.push({ lat, lng, ele, ts: Date.now() });
            const trackingExpeditionId = this.selectedTeam?.id || this.selectedExpedition?.id || null;
            this.reportLocationUpdate(trackingExpeditionId, lat, lng, pos.coords.accuracy, ele).catch(() => {});
            const activeMap = this.recordingMap || this.trackMap;
            if (activeMap && typeof AMap !== 'undefined') {
              const lnglat = new AMap.LngLat(lng, lat);
              if (!this._amapPolyline) {
                this._amapPolyline = new AMap.Polyline({ path: [lnglat], strokeColor: '#2b6579', strokeWeight: 4, map: activeMap });
              } else {
                const path = this._amapPolyline.getPath();
                path.push(lnglat);
                this._amapPolyline.setPath(path);
              }
              activeMap.setCenter(lnglat);
              activeMap.setZoom(14);
            }
            this.trackLiveStats.elevation = Math.round(ele || this.trackLiveStats.elevation);
            if (this.trackRecordedPoints.length > 1) {
              const prev = this.trackRecordedPoints[this.trackRecordedPoints.length - 2];
              const d = this._haversine(prev.lat, prev.lng, lat, lng);
              this.trackLiveStats.distance = Math.round((this.trackLiveStats.distance + d) * 1000) / 1000;
            }
          },
          () => { this._startSimulatedTracking(); },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      } else {
        this._startSimulatedTracking();
      }
      this.trackTimer = setInterval(() => {
        if (this.trackRecordingState === 'recording') this.trackLiveStats.seconds++;
      }, 1000);
    },
    _startSimulatedTracking() {
      const baseLat = 27.9881 + (Math.random() - 0.5) * 0.05;
      const baseLng = 86.9250 + (Math.random() - 0.5) * 0.05;
      let curLat = baseLat; let curLng = baseLng; let curEle = 5364;
      this._simInterval = setInterval(() => {
        if (this.trackRecordingState !== 'recording') return;
        curLat += (Math.random() - 0.48) * 0.0005;
        curLng += (Math.random() - 0.48) * 0.0005;
        curEle += (Math.random() - 0.3) * 3;
        this.trackRecordedPoints.push({ lat: curLat, lng: curLng, ele: curEle, ts: Date.now() });
        const trackingExpeditionId = this.selectedTeam?.id || this.selectedExpedition?.id || null;
        this.reportLocationUpdate(trackingExpeditionId, curLat, curLng, null, curEle).catch(() => {});
        const activeMap = this.recordingMap || this.trackMap;
        if (activeMap && typeof AMap !== 'undefined') {
          const lnglat = new AMap.LngLat(curLng, curLat);
          if (!this._amapPolyline) {
            this._amapPolyline = new AMap.Polyline({ path: [lnglat], strokeColor: '#2b6579', strokeWeight: 4, map: activeMap });
          } else {
            const path = this._amapPolyline.getPath();
            path.push(lnglat);
            this._amapPolyline.setPath(path);
          }
          activeMap.setCenter(lnglat);
        }
        this.trackLiveStats.distance = Math.round((this.trackLiveStats.distance + 0.05) * 100) / 100;
        this.trackLiveStats.elevation = Math.round(curEle);
      }, 3000);
    },
    _haversine(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },
    pauseTrackRecording() {
      this.trackRecordingState = 'paused';
    },
    async saveTrackRecording() {
      clearInterval(this.trackTimer);
      clearInterval(this._simInterval);
      if (this._geoWatch) navigator.geolocation.clearWatch(this._geoWatch);
      const name = this.newTrackName || ('轨迹记录 ' + new Date().toLocaleDateString('zh-CN'));
      const newTrack = {
        id: 'local_' + Date.now(), name,
        date: new Date().toLocaleDateString('zh-CN'),
        distance: this.trackLiveStats.distance,
        elevation: this.trackLiveStats.elevation,
        duration: this.formatTrackDuration(this.trackLiveStats.seconds),
        image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400',
        points: this.trackRecordedPoints,
      };
      this.tracks.unshift(newTrack);
      if (this.authToken) {
        // Phase 2.3: 先存 IndexedDB，再尝试立即上传
        let idbId = null;
        try { idbId = await idbSavePendingTrack({ name, points: this.trackRecordedPoints }); } catch(e) {}
        let uploadOk = false;
        try {
          const res = await apiFetch('/api/tracks', {
            method: 'POST',
            body: { name, points: this.trackRecordedPoints, distance: this.trackLiveStats.distance, elevation_gain: this.trackLiveStats.elevation, duration: this.formatTrackDuration(this.trackLiveStats.seconds) },
          });
          if (res.ok) {
            uploadOk = true;
            if (idbId !== null) await idbDeletePendingTrack(idbId).catch(() => {});
          }
        } catch(e) {}
        this.pendingUploadCount = await idbGetPendingTracks().then(t => t.length).catch(() => 0);
        if (uploadOk) {
          this.showToast('轨迹已保存：' + name + ' 🗺️');
        } else {
          this.showToast('轨迹已保存到本地，联网后自动上传 📡', 'warning');
        }
      } else {
        this.showToast('轨迹已保存：' + name + ' 🗺️');
      }
      this.trackRecordingState = 'idle';
      this.trackRecordedPoints = [];
      this.newTrackName = '';
      this._amapPolyline = null;
      if (this.recordingMap) { this.recordingMap.destroy(); this.recordingMap = null; }
      this.showNewTrackModal = false;
    },
    resumeTrackRecording() {
      this.trackRecordingState = 'recording';
    },
    stopTrackRecording() {
      if (!confirm('确定停止本次轨迹录制吗？')) return;
      clearInterval(this.trackTimer);
      clearInterval(this._simInterval);
      if (this._geoWatch) navigator.geolocation.clearWatch(this._geoWatch);
      this.trackRecordingState = 'idle';
    },
    openNewTrack() {
      this.showNewTrackModal = true;
      this.trackLiveStats = { distance: 0, elevation: 5364, seconds: 0 };
      this.$nextTick(() => {
        if (!this.recordingMap) {
          this.recordingMap = this.initAMap('recording-map', { zoom: 13 });
        }
      });
    },
    closeNewTrack() {
      if (this.trackRecordingState !== 'idle') {
        if (!confirm('确定要放弃当前记录吗？')) return;
        clearInterval(this.trackTimer);
        clearInterval(this._simInterval);
        if (this._geoWatch) navigator.geolocation.clearWatch(this._geoWatch);
        this.trackRecordingState = 'idle';
      }
      if (this.recordingMap) {
        this.recordingMap.destroy();
        this.recordingMap = null;
      }
      this._amapPolyline = null;
      this.showNewTrackModal = false;
    },
    formatTrackDuration(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },
    filterPublicTracks() {
      let list = this.publicTracks;
      if (this.publicTrackSearch.query) {
        const q = this.publicTrackSearch.query.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.author.toLowerCase().includes(q) || (t.region||'').toLowerCase().includes(q));
      }
      if (this.publicTrackSearch.difficulty) {
        list = list.filter(t => t.difficulty === this.publicTrackSearch.difficulty);
      }
      this.filteredPublicTracks = list;
    },
    // Commercial Booking - Step-by-step
    openCommercialBooking(peak) {
      if (!this.requireAuth()) return;
      const region = peak.region || peak.continent || peak.country || '';
      this.commercialBookingData = { peakName: peak.name, difficulty: peak.difficulty, region, date: '', persons: 1, package: 'standard', notes: '', selectedClub: null, selectedGuide: null, routeId: null };
      this.commercialStep = 0;
      this.commercialRouteClubs = [];
      this.commercialClubGuides = [];
      this.showCommercialBooking = true;
    },
    async loadRouteClubs() {
      if (!this.commercialBookingData.date) { this.showToast('请先选择出发日期', 'error'); return; }
      this.commercialStep = 1;
      this.commercialClubsLoading = true;
      try {
        // Try to find matching route from backend
        const routesRes = await fetch('/api/routes');
        if (routesRes.ok) {
          const routes = await routesRes.json();
          const matched = routes.find(r => r.peak && this.commercialBookingData.peakName.includes(r.peak.split(' ')[0]));
          if (matched) {
            this.commercialBookingData.routeId = matched.id;
            const clubsRes = await fetch('/api/routes/' + matched.id + '/clubs');
            if (clubsRes.ok) this.commercialRouteClubs = await clubsRes.json();
          }
        }
      } catch(e) {}
      this.commercialClubsLoading = false;
    },
    async selectCommercialClub(club) {
      this.commercialBookingData.selectedClub = club;
      this.commercialBookingData.package = 'club';
      this.commercialStep = 2;
      await this.loadClubGuides(club.club_id);
    },
    async loadClubGuides(clubId) {
      this.commercialGuidesLoading = true;
      this.commercialClubGuides = [];
      if (!clubId) { this.commercialGuidesLoading = false; return; }
      try {
        const res = await fetch('/api/clubs/' + clubId + '/guides');
        if (res.ok) this.commercialClubGuides = await res.json();
      } catch(e) {}
      this.commercialGuidesLoading = false;
    },
    selectCommercialGuide(guide) {
      this.commercialBookingData.selectedGuide = guide;
      this.commercialStep = 3;
    },
    getCommercialSubtotal() {
      if (this.commercialBookingData.selectedClub) {
        return (this.commercialBookingData.selectedClub.price || 0) * this.commercialBookingData.persons;
      }
      const pkg = this.commercialPackages.find(p => p.id === this.commercialBookingData.package) || this.commercialPackages[1];
      return pkg.price * this.commercialBookingData.persons;
    },
    getCommercialFee() { return Math.round(this.getCommercialSubtotal() * 0.015); },
    getCommercialTotal() { return this.getCommercialSubtotal() + this.getCommercialFee(); },
    async submitCommercialBooking() {
      if (!this.commercialBookingData.date) { this.showToast('请选择出发日期', 'error'); return; }
      // Try to post to backend
      if (this.authToken) {
        try {
          await fetch('/api/bookings', {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              type: 'commercial',
              peak_name: this.commercialBookingData.peakName,
              route_id: this.commercialBookingData.routeId,
              club_id: this.commercialBookingData.selectedClub?.club_id,
              guide_id: this.commercialBookingData.selectedGuide?.id,
              date: this.commercialBookingData.date,
              people: this.commercialBookingData.persons,
              price: this.getCommercialTotal(),
              notes: this.commercialBookingData.notes,
            }),
          });
        } catch(e) {}
      }
      await this.loadMyOrders();
      this.showCommercialBooking = false;
      this.showToast('预约已提交，请前往"我的订单"完成支付 ✅');
    },
    // My Orders
    openMyOrders() {
      this.showMyOrders = true;
      this.myOrdersFilter = '全部';
      this.myOrdersSubTab = 'expedition';
      this.loadMyOrders();
      this.loadActivityOrders();
      this.loadGuideServiceOrders();
    },
    async openCouponsCenter() {
      if (!this.requireAuth()) return;
      this.showCouponsCenter = true;
      this.couponTab = 'unused';
      await this.loadAllCouponTabs();
    },
    closeCouponsCenter() {
      this.showCouponsCenter = false;
    },
    async loadMyCoupons(status = 'unused') {
      this.couponsLoading = true;
      try {
        const res = await fetch(`/api/coupons/my?status=${encodeURIComponent(status)}`, { headers: this.getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        this.myCouponsByStatus[status] = data.coupons || [];
      } catch (e) {
      } finally {
        this.couponsLoading = false;
      }
    },
    async loadAllCouponTabs() {
      await Promise.all([
        this.loadMyCoupons('unused'),
        this.loadMyCoupons('used'),
        this.loadMyCoupons('expired'),
      ]);
    },
    getCouponDisplayTitle(coupon) {
      if (coupon.type === 'fixed') return `立减 ¥${Number(coupon.value || 0).toFixed(0)}`;
      const discount = Math.round((Number(coupon.value) || 0) * 100);
      return `${discount} 折优惠`;
    },
    getCouponScopeText(coupon) {
      const raw = String(coupon.applicable_types || 'all');
      if (raw === 'all') return '适用范围：全部订单';
      return '适用范围：' + raw.split(',').map((item) => {
        if (item === 'expedition') return '远征';
        if (item === 'guide') return '向导';
        if (item === 'activity') return '活动';
        return item;
      }).join(' / ');
    },
    getCouponCardClass(status) {
      if (status === 'used') return 'border-slate-500/40 bg-slate-800/70';
      if (status === 'expired') return 'border-red-500/40 bg-red-900/20';
      return 'border-emerald-500/40 bg-emerald-900/20';
    },
    async claimCoupon() {
      const code = String(this.couponClaimCode || '').trim().toUpperCase();
      if (!code) { this.showToast('请输入优惠券码', 'error'); return; }
      this.couponClaimLoading = true;
      try {
        const r = await fetch('/api/coupons/claim', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ code }),
        });
        const d = await r.json();
        if (r.ok) {
          this.showToast('🎉 领券成功！', 'success');
          this.couponClaimCode = '';
          await this.loadAllCouponTabs();
          await this.loadBookingCoupons();
        } else {
          this.showToast(d.error || '领券失败', 'error');
        }
      } catch (e) {
        this.showToast('领券失败', 'error');
      } finally {
        this.couponClaimLoading = false;
      }
    },
    async loadMyOrders() {
      if (!this.authToken) return;
      const requestId = (this._loadMyOrdersRequestId || 0) + 1;
      this._loadMyOrdersRequestId = requestId;
      const tokenSnapshot = this.authToken;
      const isLatestRequest = () => this._loadMyOrdersRequestId === requestId && this.authToken === tokenSnapshot;
      this.expeditionOrdersLoading = true;
      try {
        const res = await fetch('/api/orders', { headers: this.getAuthHeaders() });
        if (!isLatestRequest()) return;
        if (res.ok) {
          const data = await res.json();
          this.expeditionOrders = Array.isArray(data) ? data : [];
          this.myOrders = this.expeditionOrders;
        } else {
          this.expeditionOrders = [];
          this.myOrders = [];
        }
      } catch(e) {
        if (isLatestRequest()) {
          this.expeditionOrders = [];
          this.myOrders = [];
        }
      } finally {
        if (isLatestRequest()) this.expeditionOrdersLoading = false;
      }
    },
    async payExpeditionOrder(orderId, orderNo, expeditionId) {
      try {
        // 若没有 orderNo，退回旧流程
        if (!orderNo || !expeditionId) {
          const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'POST', headers: this.getAuthHeaders() });
          if (res.ok) { this.showToast('支付成功'); this.loadMyOrders(); }
          else { const d = await res.json(); this.showToast(d.error || '支付失败', 'error'); }
          return;
        }
        // 区域感知支付唤起
        const bookRes = await fetch(`/api/expeditions/${expeditionId}/book`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ order_no: orderNo }),
        });
        const bookData = await bookRes.json();
        if (!bookRes.ok) { this.showToast(bookData.error || '支付发起失败', 'error'); return; }
        await this.handlePaymentResponse({
          ...bookData,
          orderNo: orderNo || bookData.orderNo,
          payParams: {
            ...(bookData.payParams || {}),
            outTradeNo: (bookData.payParams && bookData.payParams.outTradeNo) || orderNo || '',
            amount: (bookData.payParams && bookData.payParams.amount) || Math.round(Number(this.paymentAmount || 0) * 100),
          },
        });
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async cancelExpeditionOrder(orderId) {
      try {
        const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('订单已取消'); this.loadMyOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '取消失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async refundExpeditionOrder(orderId) {
      try {
        const res = await fetch(`/api/orders/${orderId}/refund-request`, { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ reason: '用户申请退款' }) });
        if (res.ok) { this.showToast('退款申请已提交'); this.loadMyOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '申请失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    getFilteredOrders() {
      if (this.myOrdersFilter === '全部') return this.expeditionOrders;
      return this.expeditionOrders.filter(o => o.status === this.myOrdersFilter);
    },
    // Activity orders
    async loadActivityOrders() {
      if (!this.authToken) return;
      this.activityOrdersLoading = true;
      try {
        const res = await fetch('/api/activity-orders/my', { headers: this.getAuthHeaders() });
        if (res.ok) this.activityOrders = await res.json();
      } catch(e) {} finally { this.activityOrdersLoading = false; }
    },
    async payActivityOrder(id) {
      try {
        const res = await fetch(`/api/activity-orders/${id}/pay`, { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('支付成功'); this.loadActivityOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '支付失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async cancelActivityOrder(id) {
      try {
        const res = await fetch(`/api/activity-orders/${id}/cancel`, { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('订单已取消'); this.loadActivityOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '取消失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async refundActivityOrder(id) {
      try {
        const res = await fetch(`/api/activity-orders/${id}/refund-request`, { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ reason: '用户申请退款' }) });
        if (res.ok) { this.showToast('退款申请已提交'); this.loadActivityOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '申请失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    // Guide service orders
    async loadGuideServiceOrders() {
      if (!this.authToken) return;
      this.guideServiceOrdersLoading = true;
      try {
        const res = await fetch('/api/guide-service-orders/my', { headers: this.getAuthHeaders() });
        if (res.ok) this.guideServiceOrders = await res.json();
      } catch(e) {} finally { this.guideServiceOrdersLoading = false; }
    },
    async payGuideServiceOrder(id) {
      try {
        const res = await fetch(`/api/guide-service-orders/${id}/pay`, { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('支付成功'); this.loadGuideServiceOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '支付失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async cancelGuideServiceOrder(id) {
      try {
        const res = await fetch(`/api/guide-service-orders/${id}/cancel`, { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('订单已取消'); this.loadGuideServiceOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '取消失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async refundGuideServiceOrder(id) {
      try {
        const res = await fetch(`/api/guide-service-orders/${id}/refund-request`, { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ reason: '用户申请退款' }) });
        if (res.ok) { this.showToast('退款申请已提交'); this.loadGuideServiceOrders(); }
        else { const d = await res.json(); this.showToast(d.error || '申请失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    // Activity enrollment
    openActivityEnroll(club, act) {
      if (!this.requireAuth()) return;
      this.enrollingClub = club;
      this.enrollingActivity = act;
      this.enrollForm = { emergency_contact_name: '', emergency_contact_phone: '', agreed_waiver: false, waiver_version: '1.0' };
      this.showActivityEnrollModal = true;
    },
    async submitActivityEnroll() {
      if (!this.enrollForm.emergency_contact_name || !this.enrollForm.emergency_contact_phone) {
        this.showToast('请填写紧急联系人信息', 'error'); return;
      }
      if (!this.enrollForm.agreed_waiver) { this.showToast('请同意免责协议', 'error'); return; }
      this.enrollLoading = true;
      try {
        const res = await fetch(`/api/clubs/${this.enrollingClub.id}/activities/${this.enrollingActivity.id}/enroll`, {
          method: 'POST', headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(this.enrollForm)
        });
        const data = await res.json();
        if (res.ok) {
          this.showActivityEnrollModal = false;
          this.showToast('报名成功！请前往"我的订单→俱乐部活动"完成支付 ✅');
          this.activityOrders = [];
        } else {
          this.showToast(data.error || '报名失败', 'error');
        }
      } catch(e) { this.showToast('报名提交失败，请检查网络连接后重试', 'error'); } finally { this.enrollLoading = false; }
    },
    // Guide services
    async loadGuideServices(guideId) {
      this.guideServicesLoading = true;
      try {
        const res = await fetch(`/api/guides/${guideId}/services`);
        if (res.ok) this.currentGuideServices = await res.json();
        else this.currentGuideServices = [];
      } catch(e) { this.currentGuideServices = []; } finally { this.guideServicesLoading = false; }
    },
    openGuideServiceEnroll(guide, service) {
      if (!this.requireAuth()) return;
      this.enrollingGuideForService = guide;
      this.enrollingGuideService = service;
      this.guideServiceEnrollForm = { emergency_contact_name: '', emergency_contact_phone: '', agreed_waiver: false, waiver_version: '1.0', notes: '' };
      this.showGuideServiceEnrollModal = true;
    },
    async submitGuideServiceBook() {
      if (!this.guideServiceEnrollForm.emergency_contact_name || !this.guideServiceEnrollForm.emergency_contact_phone) {
        this.showToast('请填写紧急联系人信息', 'error'); return;
      }
      if (!this.guideServiceEnrollForm.agreed_waiver) { this.showToast('请同意免责协议', 'error'); return; }
      this.guideServiceEnrollLoading = true;
      try {
        const res = await fetch(`/api/guides/${this.enrollingGuideForService.id}/services/${this.enrollingGuideService.id}/book`, {
          method: 'POST', headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(this.guideServiceEnrollForm)
        });
        const data = await res.json();
        if (res.ok) {
          this.showGuideServiceEnrollModal = false;
          this.showToast('预约成功！请前往"我的订单→向导服务"完成支付 ✅');
          this.guideServiceOrders = [];
        } else {
          this.showToast(data.error || '预约失败', 'error');
        }
      } catch(e) { this.showToast('预约提交失败，请检查网络连接后重试', 'error'); } finally { this.guideServiceEnrollLoading = false; }
    },
    // My guide services management
    async loadMyGuideServices(guideId) {
      this.myGuideServicesLoading = true;
      try {
        const res = await fetch(`/api/guides/${guideId}/services`, { headers: this.getAuthHeaders() });
        if (res.ok) this.myGuideServices = await res.json();
      } catch(e) {} finally { this.myGuideServicesLoading = false; }
    },
    async submitGuideService() {
      if (!this.requireAuth()) return;
      const guideId = this.getCurrentGuideId();
      if (!guideId) {
        this.showToast('未找到当前向导身份，请先完成向导认证', 'error');
        return;
      }
      const g = this.newGuideService;
      if (!g.title) { this.showToast('请填写服务标题', 'error'); return; }
      try {
        const res = await fetch(`/api/guides/${guideId}/services`, {
          method: 'POST', headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...g, price: Number(g.price)||0, max_clients: Number(g.max_clients)||8, duration_days: Number(g.duration_days)||1 })
        });
        const data = await res.json();
        if (res.ok) {
          this.showAddGuideService = false;
          this.showToast('服务已发布 ✅');
          await this.loadGuideServices(guideId);
        } else {
          if (data.error === 'commercial_not_verified') {
            this.showToast('收费服务需先完成商业资质认证', 'error');
          } else {
            this.showToast(data.error || '发布失败', 'error');
          }
        }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async deleteMyGuideService(guideId, serviceId) {
      if (!confirm('确认删除此服务？')) return;
      try {
        const res = await fetch(`/api/guides/${guideId}/services/${serviceId}`, { method: 'DELETE', headers: this.getAuthHeaders() });
        if (res.ok) { this.showToast('服务已删除'); await this.loadGuideServices(guideId); }
        else { const d = await res.json(); this.showToast(d.error||'删除失败','error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    // Club activity management
    async loadClubActivitiesMgmt(clubId) {
      this.clubActivitiesMgmtLoading = true;
      this.showClubActivityMgmt = true;
      try {
        const res = await fetch(`/api/clubs/${clubId}/activities`, { headers: this.getAuthHeaders() });
        if (res.ok) this.clubActivitiesMgmt = await res.json();
      } catch(e) {} finally { this.clubActivitiesMgmtLoading = false; }
    },
    async viewActivityEnrollments(clubId, act) {
      this.selectedActivityForEnrollments = act;
      this.enrollmentsLoading = true;
      this.showEnrollmentsDrawer = true;
      try {
        const res = await fetch(`/api/clubs/${clubId}/activities/${act.id}/enrollments`, { headers: this.getAuthHeaders() });
        if (res.ok) this.selectedActivityEnrollments = await res.json();
        else this.selectedActivityEnrollments = [];
      } catch(e) { this.selectedActivityEnrollments = []; } finally { this.enrollmentsLoading = false; }
    },
    async toggleActivityStatus(clubId, act) {
      const newStatus = act.status === 'active' ? 'inactive' : 'active';
      try {
        const res = await fetch(`/api/clubs/${clubId}/activity/${act.id}`, {
          method: 'PUT', headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) { act.status = newStatus; this.showToast(newStatus === 'active' ? '活动已上线' : '活动已下架'); }
        else { const d = await res.json(); this.showToast(d.error||'操作失败','error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    openClubCommercialApply(clubId) {
      if (!this.requireAuth()) return;
      this.clubCommercialApplyId = clubId || this.getCurrentClubId();
      this.clubCommercialForm = { business_license_url: '', business_license_no: '', insurance_cert_url: '', bank_account_name: '', bank_account_no: '', bank_name: '' };
      this.showClubCommercialApply = true;
    },
    async uploadCommercialDoc(field, formRef, event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.type.startsWith('image/')) {
        const { valid, error } = validateImageFile(file);
        if (!valid) { alert(error); event.target.value = ''; return; }
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          formRef[field] = data.url;
          this.showToast('文件上传成功 ✅');
        } else {
          this.showToast('文件上传失败', 'error');
        }
      } catch(e) { this.showToast('上传失败', 'error'); }
      event.target.value = '';
    },
    async submitClubCommercialApply() {
      const clubId = this.clubCommercialApplyId || this.getCurrentClubId();
      if (!clubId) {
        this.showToast('请先创建或选择俱乐部，再提交商业资质认证', 'error');
        return;
      }
      this.clubCommercialLoading = true;
      try {
        const res = await fetch(`/api/clubs/${clubId}/commercial-apply`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.clubCommercialForm),
        });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message || '商业资质申请已提交 ✅');
          this.showClubCommercialApply = false;
        } else {
          this.showToast(data.error || '提交失败', 'error');
        }
      } catch(e) { this.showToast('网络错误', 'error'); }
      this.clubCommercialLoading = false;
    },
    openGuideCommercialApply(guideId) {
      if (!this.requireAuth()) return;
      this.guideCommercialApplyId = guideId || this.getCurrentGuideId();
      this.guideCommercialForm = { id_card_url: '', climbing_cert_url: '', insurance_cert_url: '', health_cert_url: '' };
      this.showGuideCommercialApply = true;
    },
    async submitGuideCommercialApply() {
      const guideId = this.guideCommercialApplyId || this.getCurrentGuideId();
      if (!guideId) {
        this.showToast('请先完成向导入驻申请，再提交商业资质认证', 'error');
        return;
      }
      this.guideCommercialLoading = true;
      try {
        const res = await fetch(`/api/guides/${guideId}/commercial-apply`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.guideCommercialForm),
        });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message || '商业资质申请已提交 ✅');
          this.showGuideCommercialApply = false;
        } else {
          this.showToast(data.error || '提交失败', 'error');
        }
      } catch(e) { this.showToast('网络错误', 'error'); }
      this.guideCommercialLoading = false;
    },
    payOrder(order) {
      this.paymentAmount = order.total;
      this.showMyOrders = false;
      this.showPayment = true;
      this._pendingOrder = order;
    },
    confirmOrderComplete(order) {
      order.status = '已完成';
      this.showToast('已确认服务完成，款项将在3-5个工作日结算给服务方 ✅');
    },
    // SOS helpers
    getSosAllContacts() {
      const contacts = [
        ...this.emergencyContacts,
        ...this.userEmergencyContacts.map(c => ({ name: c.name + '（' + c.relationship + '）', number: c.phone, country: '👤' })),
      ];
      // Add insurance rescue phone if user has active insurance
      if (this.userInsurance && this.userInsurance.has_insurance) {
        contacts.push({
          name: this.userInsurance.insurer_name + ' 救援热线',
          number: this.userInsurance.rescue_phone,
          country: '🛡️',
          tag: '保险',
          tagClass: 'bg-emerald-500/20 text-emerald-400',
        });
      }
      return contacts;
    },
    sendLocation() {
      this.showToast('定位已分享给所有紧急联系人 📍');
    },
    // Team Chat
    initTeamChat(groupChatId) {
      this.teamChatGroupId = groupChatId || null;
      this.teamChatMessages = [];
      if (groupChatId && this.authToken) {
        this.loadGroupChatMessages(groupChatId);
        // Poll for new messages every 5 seconds
        if (this._teamChatPollTimer) clearInterval(this._teamChatPollTimer);
        this._teamChatPollTimer = setInterval(() => {
          if (this.showTeamDetail && this.teamChatGroupId) {
            this.pollGroupChatMessages(this.teamChatGroupId);
          }
        }, 5000);
      }
    },
    async loadGroupChatMessages(chatId) {
      try {
        const res = await fetch('/api/group-chats/' + chatId + '/messages', { headers: this.getAuthHeaders() });
        if (res.ok) {
          const msgs = await res.json();
          const myId = this.currentUser ? this.currentUser.id : null;
          this.teamChatMessages = msgs.map(m => ({
            id: m.id, sender: m.senderName, avatar: m.senderAvatar,
            text: m.content, images: m.images || [],
            time: new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            self: m.senderId === myId,
          }));
          this._teamChatLastId = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
        }
      } catch(e) {}
    },
    async pollGroupChatMessages(chatId) {
      try {
        const after = this._teamChatLastId || 0;
        const res = await fetch('/api/group-chats/' + chatId + '/messages/poll?after=' + after, { headers: this.getAuthHeaders() });
        if (res.ok) {
          const msgs = await res.json();
          if (msgs.length > 0) {
            const myId = this.currentUser ? this.currentUser.id : null;
            const newMsgs = msgs.map(m => ({
              id: m.id, sender: m.senderName, avatar: m.senderAvatar,
              text: m.content, images: m.images || [],
              time: new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              self: m.senderId === myId,
            }));
            this.teamChatMessages.push(...newMsgs);
            this._teamChatLastId = msgs[msgs.length - 1].id;
          }
        }
      } catch(e) {}
    },
    getGroupSessionId(session) {
      if (!session) return null;
      if (session.groupChatId != null) return Number(session.groupChatId);
      if (session.type === 'team' || session.type === 'club') return Number(session.id);
      return null;
    },
    async sendTeamChat() {
      const text = this.teamChatInput.trim();
      if (!text) return;
      this.teamChatInput = '';
      // Optimistic update
      const tempMsg = {
        id: Date.now(), sender: this.userProfile.name,
        avatar: this.userProfile.avatar, text,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        self: true,
      };
      this.teamChatMessages.push(tempMsg);
      if (this.teamChatGroupId && this.authToken) {
        try {
          const res = await fetch('/api/group-chats/' + this.teamChatGroupId + '/messages', {
            method: 'POST', headers: this.getAuthHeaders(),
            body: JSON.stringify({ content: text }),
          });
          if (res.ok) {
            const data = await res.json();
            // Replace temp message with real one
            const idx = this.teamChatMessages.findIndex(m => m.id === tempMsg.id);
            if (idx >= 0) {
              this.teamChatMessages[idx].id = data.id;
              this._teamChatLastId = data.id;
            }
            // C5: Update the matching session entry's lastMsg and time
            const groupSessionId = Number(this.teamChatGroupId);
            const sessionEntry = this.chatSessions.find((s) => {
              const sessionGroupId = this.getGroupSessionId(s);
              return sessionGroupId === groupSessionId;
            });
            if (sessionEntry) {
              sessionEntry.lastMsg = text;
              sessionEntry.time = tempMsg.time;
            }
          }
        } catch(e) {}
      }
    },
    async openTrackDetail(track) {
      if (!track) return;
      this.selectedTrackDetail = track;
      this.showTrackDetail = true;
      const trackId = typeof track.id === 'string' ? track.id.trim() : track.id;
      const claimedKey = 'track_pts_claimed_' + (trackId || track.name);
      if (localStorage.getItem(claimedKey)) track._pointsClaimed = true;
      const isLocalTrack = !trackId || (typeof trackId === 'string' && trackId.startsWith('local_'));
      if (isLocalTrack) return;
      if (this.authToken) {
        try {
          const res = await fetch('/api/tracks/' + encodeURIComponent(trackId), { headers: this.getAuthHeaders() });
          if (res.ok) {
            this.selectedTrackDetail = await res.json();
            if (localStorage.getItem(claimedKey)) this.selectedTrackDetail._pointsClaimed = true;
          }
        } catch(e) {}
      }
    },
    shareTrack(track) {
      const trackId = track.id ? ('?track=' + track.id) : '';
      const url = window.location.origin + '/summitlink' + trackId;
      const text = `${track.name || '我的轨迹'} 📍${(track.distance_km || track.distance || 0)}km ↑${(track.elevation_gain || track.elevation || 0)}m - 来自巅峰探索 SummitLink`;
      const NativeShare = window.Capacitor?.Plugins?.Share;
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && NativeShare) {
        NativeShare.share({ title: track.name || '轨迹分享', text, url }).catch(() => {});
      } else if (navigator.share) {
        navigator.share({ title: track.name || '轨迹分享', text, url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text + '\n' + url).then(() => this.showToast('链接已复制 🔗'));
      } else {
        this.showToast('轨迹：' + (track.name || '我的轨迹'));
      }
    },
    async exportTrackPdf(track) {
      if (!track || !track.id) {
        this.showToast('该轨迹暂不支持导出', 'error');
        return;
      }
      if (!this.requireAuth()) return;
      try {
        const res = await fetch(`/api/tracks/${track.id}/export-pdf`, { headers: this.getAuthHeaders() });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          this.showToast(data.error || '导出失败', 'error');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `track_${track.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.showToast('PDF 导出成功');
      } catch (e) {
        console.warn('[track] exportTrackPdf failed:', e && e.message ? e.message : e);
        this.showToast('导出失败，请稍后重试', 'error');
      }
    },
    calcTrackPoints(track) {
      if (!track) return 0;
      const dist = Math.max(0, parseFloat(track.distance_km || track.distance || 0));
      const elev = Math.max(0, parseFloat(track.elevation_gain || track.elevation || 0));
      return 50 + Math.round(dist) + Math.round(elev / 100);
    },
    async claimTrackPoints(track) {
      if (!track || track._pointsClaimed) return;
      if (!this.requireAuth()) return;
      const pts = this.calcTrackPoints(track);
      const claimedKey = 'track_pts_claimed_' + (track.id || track.name);
      if (localStorage.getItem(claimedKey)) {
        track._pointsClaimed = true;
        return;
      }
      try {
        const res = await fetch(`/api/tracks/${track.id}/claim-points`, {
          method: 'POST',
          headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: pts }),
        });
        if (res.ok || res.status === 404 || res.status === 405) {
          track._pointsClaimed = true;
          try { localStorage.setItem(claimedKey, '1'); } catch(e) {}
          this.showToast(`🎉 已获得 ${pts} 积分奖励！`);
        } else {
          this.showToast('积分领取失败，请稍后重试', 'error');
        }
      } catch(e) {
        this.showToast('积分领取失败，请检查网络后重试', 'error');
      }
    },

    // Utility methods
    getDifficultyClass(difficulty) {
      const map = { '极难': 'text-red-500', '高': 'text-orange-400', '中': 'text-yellow-400', '低': 'text-green-400' };
      return map[difficulty] || 'text-slate-400';
    },
    getWeatherIcon(condition) {
      const map = { 'sunny': 'wb_sunny', 'cloudy': 'cloud', 'snowy': 'ac_unit', 'windy': 'air', 'stormy': 'thunderstorm' };
      return map[condition] || 'wb_sunny';
    },
    // Unit formatting functions
    formatDistance(km) {
      if (this.useMetric) return (Math.round(km * 10) / 10) + ' km';
      return (Math.round(km * 0.621 * 10) / 10) + ' mi';
    },
    formatElevation(m) {
      if (this.useMetric) return Math.round(m) + ' m';
      return Math.round(m * 3.281) + ' ft';
    },
    formatTemp(celsius) {
      if (this.useMetric) return Math.round(celsius) + '°C';
      return Math.round(celsius * 9/5 + 32) + '°F';
    },
    formatAlt(alt) { return this.formatElevation(alt); },
    formatWind(speed) { return this.useMetric ? speed + ' km/h' : Math.round(speed * 0.621) + ' mph'; },
    formatPrice(price) {
      if (this.currentCurrency === 'USD') return '$' + Math.round(price / 7.2).toLocaleString();
      if (this.currentCurrency === 'EUR') return '€' + Math.round(price / 7.8).toLocaleString();
      return '¥' + price.toLocaleString('zh-CN');
    },
    openPayment(amount) { this.paymentAmount = amount; this.showPayment = true; },
    openGearPurchase(item) {
      if (!this.requireAuth()) return;
      this.gearPurchaseItem = item;
      this.gearPurchaseForm = { receiver_name: this.userProfile?.name || '', receiver_phone: '', address: '' };
      this.showGearPurchase = true;
    },
    async submitGearPurchase() {
      if (!this.gearPurchaseItem) return;
      if (!this.gearPurchaseForm.receiver_name || !this.gearPurchaseForm.receiver_phone || !this.gearPurchaseForm.address) {
        this.showToast('请填写完整的收货人姓名、电话和地址', 'error'); return;
      }
      this.gearPurchaseLoading = true;
      try {
        const res = await fetch('/api/gear/' + this.gearPurchaseItem.id + '/order', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify(this.gearPurchaseForm)
        });
        const data = await res.json();
        if (res.ok) {
          this.showGearPurchase = false;
          this.showToast('购买成功！订单号：' + data.orderNo + '，等待卖家发货 📦');
          this.gearOrders = [];
        } else { this.showToast(data.error || '购买失败', 'error'); }
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
      this.gearPurchaseLoading = false;
    },
    async loadGearOrders() {
      if (!this.authToken) return;
      this.gearOrdersLoading = true;
      try {
        const res = await fetch('/api/gear/orders/mine', { headers: this.getAuthHeaders() });
        if (res.ok) this.gearOrders = await res.json();
      } catch(e) {}
      this.gearOrdersLoading = false;
    },
    async confirmGearDelivery(order) {
      try {
        const res = await fetch('/api/gear/orders/' + order.id + '/confirm', {
          method: 'POST', headers: this.getAuthHeaders()
        });
        if (res.ok) {
          this.showToast('已确认收货！');
          order.shipping_status = 'delivered';
          order.status = 'completed';
        } else {
          const d = await res.json();
          this.showToast(d.error || '操作失败', 'error');
        }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async queryPaymentStatus(orderNo) {
      if (!orderNo) return false;
      const res = await fetch(`/api/payment/query?orderNo=${encodeURIComponent(orderNo)}`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return !!data.paid;
    },
    async handlePaymentResponse(result = {}) {
      if (!result || !result.provider) {
        this.showToast('支付发起失败', 'error');
        return;
      }
      if (result.provider === 'mock') {
        const mockPayUrl = result.payParams && result.payParams.mockPayUrl;
        if (mockPayUrl) {
          window.location.href = mockPayUrl;
          return;
        }
        this.showToast('支付成功（测试模式）🎉');
        await this.onPaymentSuccess();
        return;
      }
      if (result.provider === 'wechat') {
        const payParams = result.payParams || {};
        await this.showWechatPayModal({
          ...payParams,
          outTradeNo: payParams.outTradeNo || result.orderNo || this.pendingAlipayOrderNo || '',
          amount: payParams.amount || this.paymentAmount * 100,
        });
        return;
      }
      if (result.provider === 'alipay') {
        const payUrl = result.payUrl || result.payParams?.payUrl || result.payParams?.pagePayUrl;
        if (payUrl) {
          window.open(payUrl, '_blank', 'noopener,noreferrer');
          this.showToast('支付宝支付页已在新窗口打开，完成后点击「我已支付」', 'info', 8000);
          this.pendingAlipayOrderNo = result.orderNo || result.payParams?.outTradeNo || '';
          this.showAlipayConfirm = true;
          return;
        }
        this.showToast('支付宝支付链接无效', 'error');
        return;
      }
      if (result.provider === 'stripe') {
        let clientSecret = result.clientSecret;
        if (!clientSecret && result.payParams?.endpoint && this._pendingOrder?.id) {
          const rawOrderType = String(result.orderType || this._pendingOrder.order_type || 'expedition').toLowerCase();
          const orderType = rawOrderType.includes('guide') ? 'guide_service' : (rawOrderType.includes('activity') ? 'activity' : 'expedition');
          const orderId = Number(this._pendingOrder.id);
          if (Number.isFinite(orderId) && orderId > 0) {
            const intentRes = await fetch(result.payParams.endpoint, {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({ orderType, orderId }),
            });
            if (intentRes.ok) {
              const intentData = await intentRes.json().catch(() => ({}));
              clientSecret = intentData.clientSecret || '';
            }
          } else {
            this.showToast('Stripe 支付需要有效订单ID，请刷新后重试', 'error');
            return;
          }
        }
        if (!clientSecret) {
          this.showToast('Stripe 支付暂不可用', 'error');
          return;
        }
        await this.showStripeModal(clientSecret);
        return;
      }
      this.showToast('暂不支持该支付方式', 'warning');
    },
    async showWechatPayModal(payParams = {}) {
      const amountFen = Number(payParams.amount || 0);
      this.closeWechatPay();
      this.wechatPayModal = {
        open: true,
        codeUrl: payParams.codeUrl || '',
        orderNo: payParams.outTradeNo || '',
        amount: amountFen > 0 ? (amountFen / 100).toFixed(2) : (Number(this.paymentAmount || 0).toFixed(2)),
        countdown: '3:00',
      };
      this.$nextTick(() => {
        const container = document.getElementById('wechat-qr-container');
        if (!container) return;
        container.innerHTML = '';
        if (window.QRCode && this.wechatPayModal.codeUrl) {
          new window.QRCode(container, { text: this.wechatPayModal.codeUrl, width: 160, height: 160 });
        } else {
          const fallbackText = document.createElement('p');
          fallbackText.className = 'text-xs text-slate-400 break-all px-2';
          fallbackText.textContent = `请在微信中打开支付链接：${this.wechatPayModal.codeUrl}`;
          container.appendChild(fallbackText);
        }
      });
      let remaining = 180;
      this._wechatPayTimer = setInterval(async () => {
        if (!this.wechatPayModal || !this.wechatPayModal.open) {
          this.closeWechatPay();
          return;
        }
        remaining -= 1;
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.wechatPayModal.countdown = `${m}:${String(s).padStart(2, '0')}`;
        if (remaining <= 0) {
          this.closeWechatPay();
          this.showToast('支付超时，请重新发起', 'warning');
          return;
        }
        if (remaining % 3 !== 0 || !this.wechatPayModal.orderNo) return;
        try {
          const paid = await this.queryPaymentStatus(this.wechatPayModal.orderNo);
          if (paid) await this.onPaymentSuccess();
        } catch (_) {}
      }, 1000);
    },
    closeWechatPay() {
      if (this._wechatPayTimer) {
        clearInterval(this._wechatPayTimer);
        this._wechatPayTimer = null;
      }
      this.wechatPayModal = { open: false, codeUrl: '', orderNo: '', amount: 0, countdown: '3:00' };
    },
    async confirmWechatPay() {
      if (!this.wechatPayModal.orderNo) return;
      const paid = await this.queryPaymentStatus(this.wechatPayModal.orderNo);
      if (paid) {
        await this.onPaymentSuccess();
      } else {
        this.showToast('暂未检测到支付完成，请稍后重试', 'info');
      }
    },
    async showStripeModal(clientSecret) {
      this.closeStripePay(false);
      this.stripeModal = { open: true, clientSecret, error: '', loading: false };
      try {
        const stripe = await this.ensureStripeLoaded();
        if (!stripe) {
          this.stripeModal.error = 'Stripe SDK 加载失败';
          return;
        }
        const elements = stripe.elements();
        const card = elements.create('card', { style: { base: { fontSize: '16px' } } });
        this.$nextTick(() => {
          try { card.mount('#stripe-card-element'); } catch (_) {}
        });
        this._stripeCard = card;
      } catch (e) {
        this.stripeModal.error = (e && e.message) ? e.message : 'Stripe 初始化失败';
      }
    },
    closeStripePay(resetState = true) {
      if (this._stripeCard && typeof this._stripeCard.unmount === 'function') {
        try { this._stripeCard.unmount(); } catch (_) {}
      }
      this._stripeCard = null;
      if (resetState) this.stripeModal = { open: false, clientSecret: '', error: '', loading: false };
    },
    async confirmStripePay() {
      if (!this.stripeModal.clientSecret || !this._stripeCard || !this.stripeClient) return;
      this.stripeModal.loading = true;
      this.stripeModal.error = '';
      try {
        const { paymentIntent, error } = await this.stripeClient.confirmCardPayment(
          this.stripeModal.clientSecret,
          { payment_method: { card: this._stripeCard } }
        );
        if (error) {
          this.stripeModal.error = error.message || '支付失败';
          this.stripeModal.loading = false;
          return;
        }
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          await this.onPaymentSuccess();
          return;
        }
        this.stripeModal.error = '支付未完成，请重试';
      } catch (e) {
        this.stripeModal.error = (e && e.message) ? e.message : '支付失败';
      }
      this.stripeModal.loading = false;
    },
    async confirmAlipayPaid() {
      if (!this.pendingAlipayOrderNo) {
        this.showAlipayConfirm = false;
        return;
      }
      const paid = await this.queryPaymentStatus(this.pendingAlipayOrderNo);
      if (paid) {
        await this.onPaymentSuccess();
      } else {
        this.showToast('暂未检测到支付完成，请稍后重试', 'info');
      }
    },
    async onPaymentSuccess() {
      this.closeWechatPay();
      this.closeStripePay();
      this.showAlipayConfirm = false;
      this.pendingAlipayOrderNo = '';
      this.showPayment = false;
      if (this._pendingOrder) {
        this._pendingOrder.status = '已托管';
        this._pendingOrder = null;
      }
      this.showToast('支付成功！', 'success');
      await this.loadMyOrders();
      await this.loadActivityOrders();
      await this.loadGuideServiceOrders();
      this.currentPage = 'me';
      this.meSection = 'orders';
    },
    async confirmPayment() {
      try {
        const pendingOrder = this._pendingOrder || {};
        if (String(this.paymentMethod || '').toLowerCase() === 'stripe') {
          const numericOrderId = Number(pendingOrder.id);
          if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
            this.showToast('Stripe 支付需要有效订单ID，请返回订单页重试', 'error');
            return;
          }
        }
        const orderId = pendingOrder.id || pendingOrder.order_no || `tmp_${Date.now()}`;
        const orderType = String(pendingOrder.order_type || 'expedition').toLowerCase();
        const res = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(this.getAuthHeaders() || {}) },
          body: JSON.stringify({
            order_type: orderType,
            order_id: orderId,
            amount: this.paymentAmount,
            method: this.paymentMethod,
            description: pendingOrder.title || 'SummitLink 订单',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          this.showToast(data.error || data.message || '支付暂不可用，请稍后再试', 'error');
          return;
        }
        this.showPayment = false;
        await this.handlePaymentResponse({ ...data, orderType });
      } catch(e) {
        this.showToast((e && e.message) || '支付暂不可用，请稍后再试', 'error');
      }
    },
    async submitGuideApply() {
      if (!this.guideApplyForm.name || !this.guideApplyForm.cert) {
        this.showToast('请填写姓名和证书信息', 'error'); return;
      }
      if (!this.requireAuth()) return;
      try {
        const res = await apiFetch('/api/guides/apply', { method: 'POST', body: this.guideApplyForm });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '申请失败', 'error'); return; }
        this.showGuideApply = false;
        this.showToast('向导入驻申请已提交，平台将在 1-3 个工作日内审核');
        this.guideApplyForm = { name: '', cert: '', specialty: '', languages: '', dayRate: '', region: '' };
        // TODO: 引导用户到支付页面 /api/guides/payment
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
    },
    async submitClubApply() {
      if (!this.clubApplyForm.club_name || !this.clubApplyForm.contact) {
        this.showToast('请填写俱乐部名称和联系方式', 'error'); return;
      }
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/clubs/apply', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(this.clubApplyForm) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '申请失败', 'error'); return; }
        this.showClubApplyModal = false;
        this.showToast('俱乐部入驻申请已提交，平台将在 1-3 个工作日内审核');
        this.clubApplyForm = { club_name: '', cert_url: '', contact: '', wechat: '', specialty: '', region: '', description: '', website: '' };
        // TODO: 跳转支付页面 POST /api/clubs/payment
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
    },
    goToPage(id) {
      if (id === 'track') {
        this.showToast('🗺️ 轨迹录制功能 Phase 2 即将上线，敬请期待', 'info');
        return;
      }
      this.closeWechatPay();
      this.closeStripePay();
      this.showAlipayConfirm = false;
      this.currentPage = id;
    },
    viewImage(url) { window.open(url, '_blank'); },
    viewProfile(name) { this.showToast('查看 ' + name + ' 的资料'); },
    openSidebar() { this.showToast('侧边菜单即将推出'); },
    getChatBadge(type) { const map = { 'rescue': '救援', 'guide': '向导', 'team': '组队', 'system': '系统' }; return map[type] || ''; },
    getChatIcon(type) { const map = { 'rescue': 'emergency', 'guide': 'person_pin', 'team': 'groups', 'system': 'notifications' }; return map[type] || 'chat'; },
    openSettings(type) {
      this.settingsType = type;
      this.showSettings = true;
      if (type === 'notifications') {
        this.loadNotifSettingsList();
        this.loadNotifPreferences();
      }
      if (type === 'privacy') {
        this.loadPrivacySettings();
      }
      if (type === 'help') { this.feedbackForm = { type: 'suggestion', content: '', contact: '' }; }
    },
    openEditProfile() {
      this.openSettings('profile');
    },
    handleMenuAction(action) {
      if (action === 'track') { this.goToPage('track'); }
      else if (action === 'bookings') { this.openMyBookings(); }
      else if (action === 'incoming') { this.openIncomingBookings(); }
      else if (action === 'teams') {
        this.currentPage = 'community';
        this.activeChatType = 'teams';
        this.ensureCommunityModule().then(() => {
          if (typeof this.loadPosts === 'function' && this.communityPosts.length === 0) {
            this.loadPosts().then(() => { this.filteredCommunityPosts = this.communityPosts; });
          }
        });
      }
      else if (action === 'achievements') { this.openAchievements(); }
      else if (action === 'membership') { this.openMembership(); }
      else if (action === 'coupons') { this.openCouponsCenter(); }
      else { this.showToast('即将推出'); }
    },
    async openAchievements(forceRefresh = false) {
      if (!this.requireAuth() || !this.currentUser) return;
      this.showAchievementsModal = true;
      if (!forceRefresh && this.achievementsList.length > 0) return;
      this.achievementsList = [];
      this.achievementsLoading = true;
      try {
        const res = await fetch(`/api/users/${this.currentUser.id}/achievements`, { headers: this.getAuthHeaders() });
        if (res.ok) this.achievementsList = (await res.json() || []).map(a => ({ distance: 0, elevation: 0, seconds: 0, peakName: '', ...a }));
      } catch(e) {}
      this.achievementsLoading = false;
    },
    async openMembership(forceRefresh = false) {
      if (!this.requireAuth() || !this.currentUser) return;
      this.showMembershipModal = true;
      const ttlMs = 5 * 60 * 1000;
      const cachedAt = this.membershipData && typeof this.membershipData._cachedAt === 'number'
        ? this.membershipData._cachedAt
        : 0;
      const cacheValid = !forceRefresh && this.membershipData !== null && (Date.now() - cachedAt < ttlMs);
      if (cacheValid) return;
      this.membershipData = null;
      this.membershipLoading = true;
      try {
        const res = await fetch(`/api/users/${this.currentUser.id}/membership`, { headers: this.getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          this.membershipData = data && typeof data === 'object' && !Array.isArray(data)
            ? { ...data, _cachedAt: Date.now() }
            : data;
        }
      } catch(e) {}
      this.membershipLoading = false;
    },
    async saveSettings() {
      if (this.settingsType === 'profile' && this.authToken) {
        try {
          const res = await apiFetch('/api/auth/profile', { method: 'PUT', body: { name: this.userProfile.name, avatar: this.userProfile.avatar } });
          if (res.ok) { const u = await res.json(); this.currentUser = u; this.showToast('资料已保存 ✅'); }
          else { this.showToast('保存失败', 'error'); }
        } catch(e) { this.showToast('网络错误', 'error'); }
      } else if (this.settingsType === 'units') {
        if (!this.authToken) {
          try {
            localStorage.setItem('summitlink_use_metric', this.useMetric ? '1' : '0');
            localStorage.setItem('summitlink_currency', this.currentCurrency || 'CNY');
          } catch(e) {}
          this.showToast('单位偏好已保存');
        } else {
          try {
            await fetch('/api/auth/settings', { method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify({ useMetric: this.useMetric, currency: this.currentCurrency }) });
            this.showToast('单位设置已保存 ✅');
          } catch(e) {}
        }
      } else if (this.settingsType === 'notifications' && this.authToken) {
        await this.saveNotifPreferences();
      } else if (this.settingsType === 'privacy' && this.authToken) {
        try {
          await fetch('/api/auth/privacy', { method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify(this.privacySettings) });
          this.showToast('隐私设置已保存 ✅');
        } catch(e) { this.showToast('网络错误', 'error'); }
      }
      this.showSettings = false;
    },
    async initLang() {
      const normalizeLang = (raw) => {
        if (!raw) return '';
        const next = String(raw).toLowerCase();
        if (next.startsWith('ne')) return 'ne';
        if (next.startsWith('en')) return 'en';
        if (next.startsWith('zh')) return 'zh-CN';
        return '';
      };
      const savedNew = _safeLsGet('sl_lang', null);
      const savedLegacy = _safeLsGet('locale', null);
      const saved = normalizeLang(savedNew || savedLegacy);
      if (!savedNew && savedLegacy) localStorage.removeItem('locale');
      if (saved) {
        await this.setLang(saved);
        return;
      }
      const sys = normalizeLang(navigator.language || 'zh-CN') || 'zh-CN';
      await this.setLang(sys);
    },
    async setLang(langCode) {
      const nextLang = ['zh-CN', 'en', 'ne'].includes(langCode) ? langCode : 'zh-CN';
      if (nextLang !== 'zh-CN' && !this._i18nCache['zh-CN']) {
        try {
          const zhRes = await fetch('/i18n/zh-CN.json');
          this._i18nCache['zh-CN'] = zhRes.ok ? (await zhRes.json()) : {};
        } catch (e) {
          this._i18nCache['zh-CN'] = {};
        }
      }
      if (!this._i18nCache[nextLang]) {
        try {
          const res = await fetch(`/i18n/${nextLang}.json`);
          this._i18nCache[nextLang] = res.ok ? (await res.json()) : {};
        } catch (e) {
          console.warn('[i18n] failed to load', nextLang, e);
          this._i18nCache[nextLang] = {};
        }
      }
      this.lang = nextLang;
      this.locale = nextLang;
      this.currentLang = nextLang.startsWith('en') ? 'en' : nextLang.startsWith('ne') ? 'ne' : 'zh';
      localStorage.setItem('sl_lang', nextLang);
      document.documentElement.lang = nextLang;
      if (nextLang === 'ne') {
        if (!document.getElementById('sl-devanagari-font')) {
          const link = document.createElement('link');
          link.id = 'sl-devanagari-font';
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&display=swap';
          document.head.appendChild(link);
        }
        if (document.body) document.body.style.fontFamily = "'Noto Sans Devanagari', sans-serif";
      } else if (document.body) {
        document.body.style.fontFamily = '';
      }
      this.refreshLocalizedUi();
    },
    refreshLocalizedUi() {
      this.navTabs = [
        { id: 'expedition', icon: 'explore', name: this.t('nav_expedition') },
        { id: 'discover', icon: 'groups', name: this.t('nav_explore') },
        { id: 'chat', icon: 'chat_bubble', name: this.t('nav_messages') },
        { id: 'me', icon: 'person', name: this.t('nav_me') },
      ];
      this.categories = this._baseCategories.map((category) => {
        const keyMap = {
          '8000ers': 'explore_category_8000ers',
          continental: 'explore_category_continental',
          world: 'explore_category_world',
          alpine: 'explore_category_alpine',
          commercial: 'explore_category_commercial',
        };
        const nextName = keyMap[category.id] ? this.t(keyMap[category.id]) : category.name;
        return keyMap[category.id] ? { ...category, name: nextName } : category;
      });
    },
    async setLocale(nextLocale, shouldPersist = false) {
      await this.setLang(nextLocale || 'zh-CN');
      if (!shouldPersist) localStorage.removeItem('sl_lang');
    },
    async exportMyData() {
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/gdpr/export', { headers: this.getAuthHeaders() });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          this.showToast(d.error || '导出失败', 'error');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'summitlink-gdpr-export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.showToast('数据导出已开始');
      } catch (e) {
        this.showToast('网络错误', 'error');
      }
    },
    async deleteMyAccount() {
      if (!this.requireAuth()) return;
      if (!window.confirm('确认申请注销账号？您将有 24 小时冷静期，期间可登录取消注销。')) return;
      this.accountDeletionLoading = true;
      try {
        const res = await fetch('/api/auth/request-deletion', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          this.showToast(d.error || '申请失败', 'error');
          return;
        }
        this.showToast('注销申请已提交，账号将在 24 小时后删除。您可在此期间登录取消。');
        this.showSettings = false;
        // 不立即登出，让用户有机会取消
      } catch (e) {
        this.showToast('网络错误', 'error');
      } finally {
        this.accountDeletionLoading = false;
      }
    },
    async cancelAccountDeletion() {
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/auth/cancel-deletion', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { this.showToast(d.error || '取消失败', 'error'); return; }
        this.showToast('已取消注销申请 ✅');
      } catch (e) {
        this.showToast('网络错误', 'error');
      }
    },

    // Auth methods
    getAuthHeaders() {
      const h = { 'Content-Type': 'application/json' };
      if (this.authToken) h['Authorization'] = 'Bearer ' + this.authToken;
      return h;
    },
    async doLogin() {
      const account = String(this.loginForm.account || '').trim();
      const isEmail = account.includes('@');
      if (!account) { this.showToast('请输入手机号或邮箱', 'error'); return; }
      if (!isEmail && !/^(\+?\d{7,15}|1[3-9]\d{9})$/.test(account)) { this.showToast('手机号格式不正确', 'error'); return; }
      this.loginLoading = true;
      try {
        const body = isEmail
          ? { email: account, password: this.loginForm.password }
          : { phone: account, password: this.loginForm.password };
        const res = await fetch('/api/auth/login', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '登录失败', 'error'); return; }
        this._handleLoginSuccess(data);
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
      finally { this.loginLoading = false; }
    },
    async loginWithBiometric() {
      if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
      try {
        const BiometricAuth = window.Capacitor?.Plugins?.BiometricAuth;
        const SecureStorage = window.Capacitor?.Plugins?.SecureStorage || window.Capacitor?.Plugins?.SecureStoragePlugin;
        if (!BiometricAuth || !SecureStorage) {
          this.showBiometricLogin = false;
          return;
        }
        const avail = await BiometricAuth.isAvailable();
        if (!avail || avail.isAvailable === false) {
          this.showBiometricLogin = false;
          return;
        }
        await BiometricAuth.verify({ reason: this.t('biometric_verify') || '请验证身份' });
        const tokenRes = await SecureStorage.get({ key: 'summitlink_token' });
        const token = tokenRes && (tokenRes.value || tokenRes.token);
        if (!token) return;
        this.authToken = token;
        localStorage.setItem('summitlink_token', token);
        await this.verifyToken();
        if (this.currentUser) {
          this.showLogin = false;
          this.showToast(this.t('biometric_login_success') || '生物识别登录成功');
        }
      } catch (e) {
        this.showBiometricLogin = false;
      }
    },
    async doRegister() {
      if (!/^(1[3-9]\d{9}|\+[1-9]\d{6,14})$/.test(this.registerForm.phone)) { this.showToast('请输入正确的手机号（中国大陆格式或+区号国际格式）', 'error'); return; }
      if (this.registerForm.password.length < 6) { this.showToast('密码至少6位', 'error'); return; }
      try {
        const inviteCode = (this.registerForm.inviteCode || '').trim().toUpperCase();
        const payload = { ...this.registerForm, agreedPrivacy: true, agreedTerms: true, policyVersion: this.POLICY_VERSION };
        delete payload.inviteCode;
        if (inviteCode) payload.invite_code = inviteCode;
        const res = await fetch('/api/auth/register', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '注册失败', 'error'); return; }
        this.authToken = data.token;
        this.currentUser = data.user;
        localStorage.setItem('summitlink_token', data.token);
        this.userProfile = { name: data.user.name, username: data.user.username || ('@' + data.user.name), avatar: data.user.avatar || ('https://i.pravatar.cc/150?u=' + data.user.phone), level: '新手', summits: 0, expeditions: 0, followers: 0, following: 0 };
        this.showRegister = false;
        this.registerForm = { name: '', phone: '', password: '', inviteCode: '' };
        this.showInviteCodeInput = false;
        this.agreedPrivacy = false;
        this.agreedTerms = false;
        this.loadInviteInfo();
        this.showToast('注册成功，欢迎加入 ' + data.user.name + '！');
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
    },
    doLogout() {
      try {
        this.authToken = null;
        this.currentUser = null;
        this._wasLoggedIn = false;
        try { localStorage.removeItem('summitlink_token'); } catch(_) {}
        try { localStorage.removeItem('summitlink_refresh_token'); } catch(_) {}
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          const SecureStorage = window.Capacitor?.Plugins?.SecureStorage || window.Capacitor?.Plugins?.SecureStoragePlugin;
          if (SecureStorage && SecureStorage.remove) SecureStorage.remove({ key: 'summitlink_token' }).catch(() => {});
        }
        this.userProfile = { name: '', username: '', avatar: '', level: '', summits: 0, expeditions: 0, followers: 0, following: 0 };
        this.userStats = { expeditionCount: null, totalKm: null, climbingDays: null };
        this.expeditionOrders = [];
        this.activityOrders = [];
        this.guideServiceOrders = [];
        this.myBookings = [];
        this.incomingBookings = [];
        this.achievementsList = [];
        this.membershipData = null;
        this.privacySettings = { profile_public: true, posts_public: true, follows_public: true, allow_stranger_msg: false };
        this.notifPreferences = { order_updates: true, booking_updates: true, activity_reminders: true, system_notices: true, marketing: false };
        this.notifUnreadList = [];
        this.notifUnreadCount = 0;
        this.notificationCount = 0;
        this.myInviteCode = '';
        this.inviteUrl = '';
        this.inviteStats = { totalInvited: 0, totalPoints: 0 };
        this.inviteRecords = [];
        this.showInviteRecords = false;
        this.currentPage = 'home';
        this.showToast('已退出登录');
      } catch (err) {
        console.error('[SummitLink] logout error:', err);
      }
    },
    async loadInviteInfo() {
      if (!this.authToken) return;
      try {
        const d = await fetch('/api/invite/my-code', { headers: this.getAuthHeaders() }).then(r => r.json());
        if (!d || d.error) return;
        this.myInviteCode = d.code || '';
        this.inviteUrl = d.inviteUrl || '';
        this.inviteStats = { totalInvited: Number(d.totalInvited || 0), totalPoints: Number(d.totalPoints || 0) };
      } catch (_) {}
    },
    async loadInviteRecords() {
      if (!this.authToken) return;
      this.inviteRecordsLoading = true;
      try {
        const d = await fetch('/api/invite/records', { headers: this.getAuthHeaders() }).then(r => r.json());
        this.inviteRecords = Array.isArray(d.records) ? d.records : [];
      } catch (_) {
        this.inviteRecords = [];
      } finally {
        this.inviteRecordsLoading = false;
      }
    },
    async copyInviteCode() {
      if (!this.myInviteCode) return;
      try {
        await navigator.clipboard.writeText(this.myInviteCode);
        this.showToast('邀请码已复制', 'success');
      } catch (_) {
        this.showToast('复制失败，请手动复制邀请码', 'error');
      }
    },
    async shareInviteLink() {
      if (!this.myInviteCode) return;
      const text = `我在 SummitLink 发现了绝佳的攀登资源！用我的邀请码 ${this.myInviteCode} 注册，你我各得50积分 🏔\n${this.inviteUrl}`;
      try {
        if (navigator.share) await navigator.share({ title: 'SummitLink 邀请', text });
        else { await navigator.clipboard.writeText(text); this.showToast('邀请链接已复制'); }
      } catch (_) {
        this.showToast('分享失败，请稍后重试', 'error');
      }
    },
    // SMS login
    async sendSmsCode() {
      if (!/^(\+?\d{7,15}|1[3-9]\d{9})$/.test(this.loginForm.phone)) { this.showToast('手机号格式不正确', 'error'); return; }
      if (this.smsCountdown > 0) return;
      try {
        const res = await fetch('/api/auth/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: this.loginForm.phone }) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '发送失败', 'error'); return; }
        this.showToast('验证码已发送（开发模式：查看服务器控制台）');
        this.smsCountdown = 60;
        this.smsTimer = setInterval(() => {
          this.smsCountdown--;
          if (this.smsCountdown <= 0) { clearInterval(this.smsTimer); this.smsTimer = null; }
        }, 1000);
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async doSmsLogin() {
      if (!/^(\+?\d{7,15}|1[3-9]\d{9})$/.test(this.loginForm.phone)) { this.showToast('手机号格式不正确', 'error'); return; }
      if (!this.smsCode || this.smsCode.length !== 6) { this.showToast('请输入6位验证码', 'error'); return; }
      this.loginLoading = true;
      try {
        const res = await fetch('/api/auth/sms/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: this.loginForm.phone, code: this.smsCode }) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '验证失败', 'error'); return; }
        this._handleLoginSuccess(data);
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
      finally { this.loginLoading = false; }
    },
    async doWechatLogin() {
      // Mock: generate a fake code
      const fakeCode = 'wx_' + Date.now();
      try {
        const res = await fetch('/api/auth/wechat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: fakeCode }) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '微信登录失败', 'error'); return; }
        this._handleLoginSuccess(data);
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async doAppleLogin() {
      // 未配置 Apple Client ID 时降级提示
      if (!window.__APPLE_CLIENT_ID__) {
        this.showToast('Apple 登录暂不可用', 'error');
        return;
      }
      try {
        // Capacitor 原生场景
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          try {
            const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
            const result = await SignInWithApple.authorize({
              clientId: window.__APPLE_CLIENT_ID__,
              redirectURI: window.location.origin,
              scopes: 'email name',
            });
            const idToken = result && result.response && result.response.identityToken;
            const userObj = result && result.response && result.response.user;
            if (!idToken) { this.showToast('Apple 登录失败', 'error'); return; }
            const res = await fetch('/api/auth/apple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identityToken: idToken, user: userObj }) });
            const data = await res.json();
            if (!res.ok) { this.showToast(data.error || 'Apple 登录失败', 'error'); return; }
            this._handleLoginSuccess(data);
            return;
          } catch(capErr) { console.error('[apple] capacitor error', capErr); }
        }
        // Web 场景：加载 Apple JS SDK
        if (!window.AppleID) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        window.AppleID.auth.init({
          clientId: window.__APPLE_CLIENT_ID__,
          scope: 'name email',
          redirectURI: window.location.origin,
          usePopup: true,
        });
        const appleResult = await window.AppleID.auth.signIn();
        const idToken = appleResult && appleResult.authorization && appleResult.authorization.id_token;
        const user = appleResult && appleResult.user;
        if (!idToken) { this.showToast('Apple 登录失败，未获取到 id_token', 'error'); return; }
        const res = await fetch('/api/auth/apple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identityToken: idToken, user }) });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || 'Apple 登录失败', 'error'); return; }
        this._handleLoginSuccess(data);
      } catch(e) {
        if (e && e.error === 'popup_closed_by_user') return; // 用户主动关闭
        console.error('[apple login]', e);
        this.showToast('Apple 登录失败，请重试', 'error');
      }
    },
    async doGoogleLogin() {
      if (!window.__GOOGLE_CLIENT_ID__) {
        this.showToast('Google 登录暂不可用', 'error');
        return;
      }
      try {
        // 加载 Google Identity Services (GIS)
        if (!window.google || !window.google.accounts) {
          await new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
              // Script tag exists but SDK not ready yet — poll for up to 5s
              let elapsed = 0;
              const check = setInterval(() => {
                elapsed += 100;
                if (window.google && window.google.accounts) { clearInterval(check); resolve(); }
                else if (elapsed >= 5000) { clearInterval(check); reject(new Error('Google SDK 加载超时')); }
              }, 100);
              return;
            }
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.onerror = () => reject(new Error('Google SDK 加载失败'));
            s.onload = () => {
              let elapsed = 0;
              const check = setInterval(() => {
                elapsed += 100;
                if (window.google && window.google.accounts) { clearInterval(check); resolve(); }
                else if (elapsed >= 5000) { clearInterval(check); reject(new Error('Google SDK 初始化超时')); }
              }, 100);
            };
            document.head.appendChild(s);
          });
        }
        const credential = await new Promise((resolve, reject) => {
          let settled = false;
          let oauthRequested = false;
          const timeoutId = setTimeout(() => settle(reject, new Error('Google 登录超时，请重试')), 60000);
          const settle = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            fn(value);
          };

          window.google.accounts.id.initialize({
            client_id: window.__GOOGLE_CLIENT_ID__,
            callback: (response) => {
              if (response && response.credential) settle(resolve, response.credential);
              else settle(reject, new Error('未获取到 Google credential'));
            },
            cancel_on_tap_outside: false,
          });

          window.google.accounts.id.prompt((notification) => {
            const notDisplayed = notification && typeof notification.isNotDisplayed === 'function' && notification.isNotDisplayed();
            const skipped = notification && typeof notification.isSkippedMoment === 'function' && notification.isSkippedMoment();
            const dismissed = notification && typeof notification.isDismissedMoment === 'function' && notification.isDismissedMoment();
            if (notDisplayed || skipped || dismissed) {
              if (settled || oauthRequested) return;
              try {
                oauthRequested = true;
                if (settled) return;
                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                  client_id: window.__GOOGLE_CLIENT_ID__,
                  scope: 'openid email profile',
                  callback: (tokenResponse) => {
                    if (!tokenResponse || tokenResponse.error || !tokenResponse.access_token) {
                      settle(reject, new Error((tokenResponse && tokenResponse.error) || 'Google 授权失败'));
                      return;
                    }
                    settle(resolve, { accessToken: tokenResponse.access_token });
                  },
                  error_callback: (err) => settle(reject, new Error((err && err.message) || 'Google 授权错误')),
                });
                tokenClient.requestAccessToken({ prompt: 'select_account' });
              } catch (e) {
                settle(reject, e);
              }
            }
          });

        });
        const body = typeof credential === 'string'
          ? { idToken: credential }
          : { accessToken: credential.accessToken };
        const res = await apiFetch('/api/auth/google', { method: 'POST', body });
        const data = await res.json();
        this._handleLoginSuccess(data);
      } catch(e) {
        console.error('[google login]', e);
        this.showToast(e.message || 'Google 登录失败，请重试', 'error');
      }
    },
    _handleLoginSuccess(data) {
      this.authToken = data.token;
      this._wasLoggedIn = true;
      if (data.refreshToken) localStorage.setItem('summitlink_refresh_token', data.refreshToken);
      this.currentUser = data.user;
      localStorage.setItem('summitlink_token', data.token);
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        const SecureStorage = window.Capacitor?.Plugins?.SecureStorage || window.Capacitor?.Plugins?.SecureStoragePlugin;
        if (SecureStorage && SecureStorage.set) {
          SecureStorage.set({ key: 'summitlink_token', value: data.token }).catch(() => {});
        }
      }
      this.userProfile = { name: data.user.name, username: data.user.username || ('@' + data.user.name), avatar: data.user.avatar || ('https://i.pravatar.cc/150?u=' + data.user.id), level: data.user.level || '攀登者', summits: data.user.summits || 0, expeditions: data.user.expeditions || 0, followers: data.user.followers || 0, following: data.user.following || 0 };
      this.showLogin = false;
      this.loginForm = { account: '', phone: '', password: '' };
      this.smsCode = '';
      this.loadGuideStatus();
      this.loadClubStatus();
      this.loadUserStats();
      this.loadInviteInfo();
      this.showToast('登录成功，欢迎 ' + data.user.name + '！');
    },
    requireAuth() {
      if (!this.authToken) { this.showLogin = true; return false; }
      return true;
    },
    async verifyToken() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/auth/me', { headers: this.getAuthHeaders() });
        if (!res.ok) { localStorage.removeItem('summitlink_token'); this.authToken = null; this.currentUser = null; return; }
        const user = await res.json();
        this.currentUser = user;
        if (user && user.privacy_settings && typeof user.privacy_settings === 'object') {
          this.privacySettings = {
            profile_public: typeof user.privacy_settings.profile_public === 'boolean' ? user.privacy_settings.profile_public : this.privacySettings.profile_public,
            posts_public: typeof user.privacy_settings.posts_public === 'boolean' ? user.privacy_settings.posts_public : this.privacySettings.posts_public,
            follows_public: typeof user.privacy_settings.follows_public === 'boolean' ? user.privacy_settings.follows_public : this.privacySettings.follows_public,
            allow_stranger_msg: typeof user.privacy_settings.allow_stranger_msg === 'boolean' ? user.privacy_settings.allow_stranger_msg : this.privacySettings.allow_stranger_msg,
          };
        }
        this.userProfile = { name: user.name, username: user.username || ('@' + user.name), avatar: user.avatar || ('https://i.pravatar.cc/150?u=' + user.phone), level: user.level || '攀登者', summits: user.summits || 0, expeditions: user.expeditions || 0, followers: user.followers || 0, following: user.following || 0 };
        this.loadGuideStatus();
        this.loadClubStatus();
        this.loadUserStats();
        this.loadInviteInfo();
        this.loadPrivacySettings();
        this.loadUnitSettings();
      } catch(e) {}
    },
    async loadPrivacySettings() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/auth/privacy', { headers: this.getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') return;
        this.privacySettings = {
          profile_public: typeof data.profile_public === 'boolean' ? data.profile_public : this.privacySettings.profile_public,
          posts_public: typeof data.posts_public === 'boolean' ? data.posts_public : this.privacySettings.posts_public,
          follows_public: typeof data.follows_public === 'boolean' ? data.follows_public : this.privacySettings.follows_public,
          allow_stranger_msg: typeof data.allow_stranger_msg === 'boolean' ? data.allow_stranger_msg : this.privacySettings.allow_stranger_msg,
        };
      } catch(e) {}
    },
    async loadUnitSettings() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/auth/settings', { headers: this.getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') return;
        if (typeof data.useMetric === 'boolean') this.useMetric = data.useMetric;
        const currency = data.currency || data.currentCurrency;
        if (typeof currency === 'string' && currency.trim()) this.currentCurrency = currency;
      } catch(e) {}
    },
    async loadGuideStatus() {
      if (!this.authToken) return;
      const requestId = (this._guideStatusRequestId || 0) + 1;
      this._guideStatusRequestId = requestId;
      const tokenSnapshot = this.authToken;
      const isLatestRequest = () => this._guideStatusRequestId === requestId && this.authToken === tokenSnapshot;
      try {
        const res = await fetch('/api/guides/me', { headers: this.getAuthHeaders() });
        if (!isLatestRequest()) return;
        if (res.ok) {
          const data = await res.json();
          if (this.currentUser) {
            this.currentUser = { ...this.currentUser, guide_status: data.status || 'none', guide_id: data.id || null };
          }
        }
      } catch(e) {}
    },
    async loadClubStatus() {
      if (!this.authToken) return;
      const requestId = (this._clubStatusRequestId || 0) + 1;
      this._clubStatusRequestId = requestId;
      const tokenSnapshot = this.authToken;
      const isLatestRequest = () => this._clubStatusRequestId === requestId && this.authToken === tokenSnapshot;
      try {
        const res = await fetch('/api/clubs/me', { headers: this.getAuthHeaders() });
        if (!isLatestRequest()) return;
        if (res.ok) {
          const data = await res.json();
          if (this.currentUser && data && data.id) {
            this.currentUser = { ...this.currentUser, club_id: data.id, is_club_admin: true };
          }
        }
      } catch(e) {}
    },

    // Data loading methods
    async loadPeaks(type) {
      this.peaksLoading = true;
      try {
        const t = type || this.activeCategory;
        const categoryMap = {
          '8000ers': 'eight_thousanders',
          continental: 'seven_summits',
          world: 'classic',
          alpine: 'technical',
        };
        const apiCategory = categoryMap[t];
        if (!apiCategory) return;
        const res = await fetch('/api/peaks?category=' + apiCategory);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = data.map(p => enrichPeakDetail({ ...p, countryFlag: p.countryFlag || '', icon: '🏔️', nameEn: p.nameEn || p.name }));
        if (t === '8000ers') this.eightThousanders = mapped;
        else if (t === 'continental') this.continentalPeaks = mapped;
        else if (t === 'world') this.worldPeaks = mapped;
        else if (t === 'alpine') this.climbingSpots = mapped;
      } catch(e) {} finally { this.peaksLoading = false; }
    },
    async loadGuides() {
      try {
        const res = await _fetchWithTimeout('/api/guides');
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        this.nearbyGuides = list.map(g => ({ ...g, tag: g.rating >= 4.8 ? '🏅 认证精英' : '' }));
        this.guides = list;
        this._homeDataLoadedOnce = true;
      } catch(e) {
        if (e && e.name === 'AbortError') {
          this.showToast('网络超时，请检查网络连接', 'warning');
        } else {
          console.warn('[SummitLink] 数据加载失败:', e && e.message ? e.message : e);
          if (!this._homeDataLoadedOnce) this.showToast('数据加载失败，请下拉刷新', 'error');
        }
        if (!Array.isArray(this.expeditionCards)) this.expeditionCards = [];
        if (!Array.isArray(this.nearbyGuides)) this.nearbyGuides = [];
        if (!Array.isArray(this.featuredClubs)) this.featuredClubs = [];
      }
    },
    async loadTeams() {
      this.teamsLoading = true;
      try {
        const res = await fetch('/api/teams');
        if (!res.ok) return;
        const data = await res.json();
        this.teams = data;
      } catch(e) {} finally { this.teamsLoading = false; }
    },
    async loadGear(mode, category) {
      try {
        const m = mode || this.gearMode;
        const c = category !== undefined ? category : this.gearCategory;
        let url = '/api/gear?mode=' + m;
        if (c && c !== '全部') url += '&category=' + encodeURIComponent(c);
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        this.gearItems = data;
      } catch(e) {}
    },
    async loadPosts() {
      this.postsLoading = true;
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) return;
        const data = await res.json();
        this.communityPosts = data.map(p => ({
          ...p,
          author: p.authorName,
          authorAvatar: p.authorAvatar,
          timeAgo: p.createdAt ? new Date(p.createdAt).toLocaleDateString('zh-CN') : '最近',
          isLiked: false,
          isFavorited: false,
          commentPreview: [],
        }));
        this.filteredCommunityPosts = this.communityPosts;
      } catch(e) {} finally { this.postsLoading = false; }
    },
    // loadLeaderboard() — 已删除，本月攀登榜移至二期
    async loadWeather() {
      try {
        const res = await fetch('/api/weather?location=珠峰大本营');
        if (!res.ok) return;
        const data = await res.json();
        this.weather = { ...data, condition: 'partly_cloudy' };
      } catch(e) {}
    },
    async loadTracks() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/tracks', { headers: this.getAuthHeaders() });
        if (!res.ok) {
          // Fallback to /my for backward compat
          const res2 = await fetch('/api/tracks/my', { headers: this.getAuthHeaders() });
          if (!res2.ok) return;
          const data2 = await res2.json();
          if (data2.length > 0) this.tracks = data2;
          return;
        }
        const data = await res.json();
        if (data.length > 0) this.tracks = data;
      } catch(e) {}
    },

    // Comments
    async loadComments(postId) {
      this.commentsLoading = true;
      try {
        const res = await fetch('/api/comments?post_id=' + postId);
        if (res.ok) { this.selectedPostComments = await res.json(); }
      } catch(e) {}
      this.commentsLoading = false;
    },

    // Clubs
    async loadClubs() {
      try {
        const res = await fetch('/api/clubs');
        if (res.ok) {
          const data = await res.json();
          this.clubs = data.map(c => ({
            ...c,
            cover: c.cover || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400',
            verified: !!c.verified,
            specialty: c.specialty || '攀登',
            achievements: [],
          }));
        }
      } catch(e) {}
    },

    // Chat/Messages
    async loadConversations() {
      if (!this.authToken) return;
      this.initChatSocket();
      this.chatLoading = true;
      try {
        const res = await fetch('/api/messages/conversations', { headers: this.getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          this.chatSessions = data.map(c => ({
            id: c.id,
            conversationId: c.id,
            name: c.otherName,
            avatar: c.otherAvatar || ('https://i.pravatar.cc/150?u=' + c.otherId),
            flag: '',
            type: 'user',
            online: false,
            unread: c.unread || 0,
            lastMsg: c.lastMsg || '',
            time: c.updated_at ? new Date(c.updated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
            messages: [],
          }));
        } else {
          this.chatSessions = [];
        }
      } catch(e) {
        this.chatSessions = [];
      } finally {
        this.chatLoading = false;
      }
    },
    async openChatSession(session) {
      this.activeChatSession = session;
      this.showChatWindow = true;
      this._chatLastMsgId = 0;
      if (this.authToken && session.conversationId) {
        try {
          const res = await fetch('/api/messages/conversations/' + session.conversationId + '/messages', { headers: this.getAuthHeaders() });
          if (res.ok) {
            const msgs = await res.json();
            const myId = this.currentUser ? this.currentUser.id : null;
            this.activeChatSession.messages = msgs.map(m => ({
              id: m.id,
              from: m.sender_id === myId ? 'me' : 'them',
              text: m.content || null,
              images: m.images || [],
              status: m.sender_id === myId ? (m.is_read ? 'read' : 'sent') : null,
              time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            }));
            this._chatLastMsgId = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
            this.activeChatSession.unread = 0;
            this.joinChatConversationSocket(session.conversationId);
            const lastIncoming = [...msgs].reverse().find((m) => m.sender_id !== myId);
            if (lastIncoming && this._chatSocket && this._chatSocket.connected) {
              this._chatSocket.emit('chat:read', { conv_id: session.conversationId, msg_id: lastIncoming.id });
            }
          }
        } catch(e) {}
      }
      // Start polling for new messages every 5 seconds
      if (this._chatPollTimer) clearInterval(this._chatPollTimer);
      this._chatPollTimer = setInterval(() => {
        if (this.showChatWindow && this.activeChatSession && this.activeChatSession.conversationId && this.authToken) {
          this.pollChatMessages(this.activeChatSession.conversationId);
        } else {
          clearInterval(this._chatPollTimer);
        }
      }, 5000);
    },
    async pollChatMessages(conversationId) {
      try {
        const after = this._chatLastMsgId || 0;
        const res = await fetch('/api/messages/conversations/' + conversationId + '/messages/poll?after=' + after, { headers: this.getAuthHeaders() });
        if (res.ok) {
          const msgs = await res.json();
          if (msgs.length > 0 && this.activeChatSession) {
            const myId = this.currentUser ? this.currentUser.id : null;
            const newMsgs = msgs.map(m => ({
              id: m.id,
              from: m.sender_id === myId ? 'me' : 'them',
              text: m.content || null,
              images: m.images || [],
              status: m.sender_id === myId ? (m.is_read ? 'read' : 'sent') : null,
              time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            }));
            const existingIds = new Set(this.activeChatSession.messages.map(m => m.id).filter(Boolean));
            const uniqueMsgs = newMsgs.filter(m => !existingIds.has(m.id));
            if (uniqueMsgs.length > 0) {
              this.activeChatSession.messages.push(...uniqueMsgs);
            }
            this._chatLastMsgId = msgs[msgs.length - 1].id;
            const lastIncoming = [...msgs].reverse().find((m) => m.sender_id !== myId);
            if (lastIncoming && this._chatSocket && this._chatSocket.connected) {
              this._chatSocket.emit('chat:read', { conv_id: conversationId, msg_id: lastIncoming.id });
            }
            this.$nextTick(() => {
              const el = document.getElementById('chat-messages-container');
              if (el) el.scrollTop = el.scrollHeight;
            });
          }
        }
      } catch(e) {}
    },
    async sendChatMessage() {
      if (!this.chatInput.trim() && this.chatImagePreviews.length === 0) return;
      if (!this.activeChatSession) return;
      if (!this.activeChatSession.conversationId) {
        this.showToast('无法发送消息，请重新打开会话', 'error');
        return;
      }
      const text = this.chatInput.trim();
      const images = [...this.chatImagePreviews];
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const msgType = text && images.length > 0 ? 'mixed' : (images.length > 0 ? 'image' : 'text');
      this.activeChatSession.messages.push({ from: 'me', text: text || null, images, time, status: 'sent' });
      this.chatInput = '';
      this.chatImagePreviews = [];
      this.$nextTick(() => {
        const el = document.getElementById('chat-messages-container');
        if (el) el.scrollTop = el.scrollHeight;
      });
      const hasSocketTextPath = this._chatSocket && this._chatSocket.connected && this.activeChatSession.conversationId && text && images.length === 0;
      if (hasSocketTextPath) {
        this.joinChatConversationSocket(this.activeChatSession.conversationId);
        this._chatSocket.emit('chat:message', { conv_id: this.activeChatSession.conversationId, content: text, type: 'text' });
        return;
      }
      if (this.authToken && this.activeChatSession.conversationId) {
        try {
          let uploadedUrls = [];
          if (images.length > 0 && images[0].startsWith('blob:')) {
            uploadedUrls = await this.uploadImages(images);
          } else {
            uploadedUrls = images;
          }
          await fetch('/api/messages/conversations/' + this.activeChatSession.conversationId + '/messages', {
            method: 'POST', headers: this.getAuthHeaders(),
            body: JSON.stringify({ content: text, type: msgType, images: uploadedUrls })
          });
        } catch(e) {}
      }
    },
    initChatSocket() {
      if (!this.authToken || !window.io || this._chatSocket) return;
      const apiBase = (window.__API_BASE__ || '').replace(/\/$/, '');
      this._chatSocket = window.io(apiBase || '/', {
        auth: { token: this.authToken },
        transports: ['polling', 'websocket'],
        reconnectionDelay: 3000,
        reconnectionDelayMax: 30000,
        timeout: 10000,
      });
      this._chatSocket.on('connect_error', (err) => {
        console.warn('[chat] Socket 连接失败:', err && err.message ? err.message : err);
      });
      this._chatSocket.on('connect', () => {
        if (this.activeChatSession?.conversationId) {
          this.joinChatConversationSocket(this.activeChatSession.conversationId);
        }
      });
      this._chatSocket.on('chat:message', (msg) => {
        if (!msg || !msg.conversation_id) return;
        const convId = Number(msg.conversation_id);
        const myId = this.currentUser ? Number(this.currentUser.id) : null;
        const fromMe = myId != null && Number(msg.sender_id) === myId;
        const normalized = {
          id: msg.id,
          from: fromMe ? 'me' : 'them',
          text: msg.content || null,
          images: (msg.images && Array.isArray(msg.images)) ? msg.images : [],
          status: fromMe ? 'sent' : null,
          time: new Date(msg.created_at || Date.now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        const target = this.chatSessions.find((s) => Number(s.conversationId) === convId);
        if (target) {
          target.lastMsg = normalized.text || (normalized.images.length > 0 ? '[图片]' : '');
          target.time = normalized.time;
        }
        if (this.activeChatSession && Number(this.activeChatSession.conversationId) === convId) {
          const exists = this.activeChatSession.messages.some((m) => m.id && Number(m.id) === Number(normalized.id));
          if (!exists) this.activeChatSession.messages.push(normalized);
          this._chatLastMsgId = Math.max(this._chatLastMsgId || 0, Number(normalized.id) || 0);
          if (!fromMe) this._chatSocket.emit('chat:read', { conv_id: convId, msg_id: normalized.id });
          this.$nextTick(() => {
            const el = document.getElementById('chat-messages-container');
            if (el) el.scrollTop = el.scrollHeight;
          });
        } else if (target && !fromMe) {
          target.unread = (target.unread || 0) + 1;
        }
      });
      this._chatSocket.on('chat:read', ({ msg_id, userId }) => {
        if (!this.activeChatSession || !Array.isArray(this.activeChatSession.messages)) return;
        const myId = this.currentUser ? Number(this.currentUser.id) : null;
        if (myId != null && Number(userId) === myId) return;
        this.activeChatSession.messages = this.activeChatSession.messages.map((m) => {
          if (m.from === 'me' && m.id && Number(m.id) <= Number(msg_id)) {
            return { ...m, status: 'read' };
          }
          return m;
        });
      });
    },
    joinChatConversationSocket(conversationId) {
      if (!conversationId || !this._chatSocket || !this._chatSocket.connected) return;
      if (this._socketBoundConversations.has(conversationId)) return;
      this._chatSocket.emit('chat:join', { conv_id: conversationId });
      this._socketBoundConversations.add(conversationId);
    },

    // 通用图片上传（接受 blob URL 数组，返回服务器 URL 数组）
    async uploadImages(blobUrls) {
      try {
        const formData = new FormData();
        for (const blobUrl of blobUrls) {
          const resp = await fetch(blobUrl);
          const blob = await resp.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          formData.append('files', blob, `image.${ext}`);
        }
        const res = await fetch('/api/upload/multiple', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + this.authToken },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          return data.urls || [];
        }
        this.showToast('图片上传失败，请重试', 'error');
      } catch(e) {
        this.showToast('图片上传失败，请检查网络', 'error');
      }
      return blobUrls; // fallback: keep blob URLs for local preview
    },

    // 聊天选图
    handleChatImageSelect(event) {
      const files = event.target.files;
      const { validFiles, errors } = validateImageFiles(files);
      if (errors.length > 0) {
        alert('以下图片无法上传：\n' + errors.join('\n'));
      }
      if (validFiles.length === 0) { event.target.value = ''; return; }
      validFiles.forEach(f => {
        this.chatImagePreviews.push(URL.createObjectURL(f));
      });
      event.target.value = '';
    },

    // 发帖选图
    handlePostImageSelect(event) {
      const files = event.target.files;
      const { validFiles, errors } = validateImageFiles(files);
      if (errors.length > 0) {
        alert('以下图片无法上传：\n' + errors.join('\n'));
      }
      if (validFiles.length === 0) { event.target.value = ''; return; }
      validFiles.forEach(f => {
        this.newPost.images.push(URL.createObjectURL(f));
      });
      event.target.value = '';
    },

    // 发帖选视频
    handlePostVideoSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 200 * 1024 * 1024) { this.showToast('视频大小不能超过200MB', 'error'); return; }
      this.newPost.videoPreview = URL.createObjectURL(file);
      this.newPost.videoFile = file;
      event.target.value = '';
    },

    // 手动登顶证明照片选择
    handleManualSummitImageSelect(event) {
      const files = event.target.files;
      const { validFiles, errors } = validateImageFiles(files);
      if (errors.length > 0) {
        alert('以下图片无法上传：\n' + errors.join('\n'));
      }
      if (validFiles.length === 0) { event.target.value = ''; return; }
      validFiles.forEach(f => {
        this.manualSummit.proof_images.push(URL.createObjectURL(f));
      });
      event.target.value = '';
    },

    // 提交手动登顶记录
    async submitManualSummit() {
      if (!this.requireAuth()) return;
      if (!this.manualSummit.peak_name) { this.showToast('请输入山峰名称', 'error'); return; }
      if (!this.manualSummit.date) { this.showToast('请选择攀登日期', 'error'); return; }
      if (this.manualSummit.proof_images.length === 0) { this.showToast('请至少上传一张证明照片', 'error'); return; }
      try {
        // 上传证明照片
        const blobImages = this.manualSummit.proof_images.filter(u => u.startsWith('blob:'));
        let uploadedUrls = [];
        if (blobImages.length > 0) uploadedUrls = await this.uploadImages(blobImages);
        const serverUrls = [...this.manualSummit.proof_images.filter(u => !u.startsWith('blob:')), ...uploadedUrls];
        const res = await fetch('/api/tracks/manual', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({
            peak_name: this.manualSummit.peak_name,
            date: this.manualSummit.date,
            altitude: this.manualSummit.altitude ? parseInt(this.manualSummit.altitude) : null,
            notes: this.manualSummit.notes,
            proof_images: serverUrls,
          })
        });
        const data = await res.json();
        if (res.ok) {
          this.showToast('登顶记录已提交 🏔️');
          this.showManualSummitModal = false;
          this.manualSummit = { peak_name: '', date: '', altitude: '', notes: '', proof_images: [] };
          this.loadTracks();
        } else {
          this.showToast(data.error || '提交失败', 'error');
        }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },

    // 评论选图
    handleCommentImageSelect(event) {
      const files = event.target.files;
      const { validFiles, errors } = validateImageFiles(files);
      if (errors.length > 0) {
        alert('以下图片无法上传：\n' + errors.join('\n'));
      }
      if (validFiles.length === 0) { event.target.value = ''; return; }
      validFiles.forEach(f => {
        this.commentImagePreviews.push(URL.createObjectURL(f));
      });
      event.target.value = '';
    },

    // Notifications
    async loadSummitWindow(peakId) {
      this.summitWindow = [];
      this.summitWindowExpanded = -1;
      if (!peakId) return;
      try {
        const res = await fetch(`/api/weather/summit-window/${encodeURIComponent(peakId)}`);
        if (res.ok) {
          const data = await res.json();
          this.summitWindow = Array.isArray(data) ? data : (data.days || []);
        }
      } catch(e) {}
    },
    copyText(text) {
      navigator.clipboard?.writeText(text).then(() => this.showToast('链接已复制')).catch(() => this.showToast('复制失败', 'error'));
    },
    async loadNotifications() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/notifications', { headers: this.getAuthHeaders() });
        if (res.ok) { return await res.json(); }
      } catch(e) {}
      return [];
    },

    // Follows
    async followUser(targetId) {
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/follows', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ target_id: targetId }) });
        const data = await res.json();
        this.showToast(res.ok ? data.message : (data.error || '操作失败'), res.ok ? 'success' : 'error');
      } catch(e) { this.showToast('网络错误', 'error'); }
    },

    // Guide profile full
    async openGuideProfile(guideId, localGuideData = null) {
      try {
        const [guide, expeditions, reviews, posts, photos] = await Promise.all([
          fetch('/api/guides/' + guideId).then(r => r.ok ? r.json() : null),
          fetch('/api/guides/' + guideId + '/expeditions').then(r => r.ok ? r.json() : []),
          fetch('/api/guides/' + guideId + '/reviews').then(r => r.ok ? r.json() : []),
          fetch('/api/guides/' + guideId + '/posts').then(r => r.ok ? r.json() : []),
          fetch('/api/guides/' + guideId + '/photos').then(r => r.ok ? r.json() : []),
        ]);
        const guideData = guide || localGuideData;
        if (!guideData) { this.showToast('向导信息获取失败', 'error'); return; }
        this.currentGuideProfile = { ...guideData, expeditions: expeditions || [], reviews_list: reviews || [], posts: posts || [], photos: photos || [] };
        this.guideReviewForm = { rating: 5, content: '' };
        this.currentGuideServices = [];
        this.showGuideProfileModal = true;
        this.loadGuideServices(guideId);
      } catch(e) {
        if (localGuideData) {
          // Fallback to local data when API is unavailable (e.g., mock guides)
          this.currentGuideProfile = { ...localGuideData, expeditions: [], reviews_list: [], posts: [], photos: [] };
          this.guideReviewForm = { rating: 5, content: '' };
          this.currentGuideServices = [];
          this.showGuideProfileModal = true;
        } else {
          this.showToast('网络错误', 'error');
        }
      }
    },
    async submitGuideReview() {
      if (!this.requireAuth()) return;
      if (!this.currentGuideProfile) return;
      try {
        const res = await fetch('/api/guides/' + this.currentGuideProfile.id + '/review', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ rating: this.guideReviewForm.rating, content: this.guideReviewForm.content })
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '评价失败', 'error'); return; }
        this.showToast('评价已提交 ✅');
        this.guideReviewForm = { rating: 5, content: '' };
        // Refresh reviews
        const reviews = await fetch('/api/guides/' + this.currentGuideProfile.id + '/reviews').then(r => r.json()).catch(() => []);
        this.currentGuideProfile.reviews_list = reviews;
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    openBookingForGuide(guide) {
      this.showGuideProfileModal = false;
      this.bookingData.mountain = guide.specialty ? guide.specialty.split('/')[0].trim() : '';
      this.bookingData.guide = guide;
      this.bookingData.guide_id = guide.id;
      this.bookingData.guide_name = guide.name;
      this.bookingData.coupon_id = null;
      this.selectedBookingCoupon = null;
      this.bookingCouponPreview = null;
      this.showBookingCouponPanel = false;
      this.showBooking = true;
      this.loadBookingCoupons();
    },

    // Club profile full
    async openClubProfile(clubId) {
      try {
        const [club, activities, members, reviews, posts, photos, guidesList] = await Promise.all([
          fetch('/api/clubs/' + clubId).then(r => r.ok ? r.json() : null),
          fetch('/api/clubs/' + clubId + '/activities').then(r => r.ok ? r.json() : []),
          fetch('/api/clubs/' + clubId + '/members').then(r => r.ok ? r.json() : []),
          fetch('/api/clubs/' + clubId + '/reviews').then(r => r.ok ? r.json() : []),
          fetch('/api/clubs/' + clubId + '/posts').then(r => r.ok ? r.json() : []),
          fetch('/api/clubs/' + clubId + '/photos').then(r => r.ok ? r.json() : []),
          fetch('/api/clubs/' + clubId + '/guides').then(r => r.ok ? r.json() : []),
        ]);
        if (!club) {
          // 尝试从本地 featuredClubs 获取 mock 数据
          const local = this.featuredClubs.find(c => String(c.id) === String(clubId));
          if (local) {
            this.currentClubProfile = { ...local, activities: [], members_list: [], reviews: [], guides_list: [], photos: [], posts: [] };
            this.showClubProfileModal = true;
            return;
          }
          this.showToast('俱乐部信息获取失败', 'error'); return;
        }
        this.currentClubProfile = { ...club, activities, members_list: members, reviews_list: reviews, posts, photos, guides_list: guidesList };
        this.clubActivityTab = 'activity';
        this.clubReviewForm = { rating: 5, content: '' };
        this.showClubProfileModal = true;
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async joinCurrentClub() {
      if (!this.requireAuth()) return;
      if (!this.currentClubProfile) return;
      try {
        const res = await fetch('/api/clubs/' + this.currentClubProfile.id + '/join', { method: 'POST', headers: this.getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
          this.showToast('已成功加入俱乐部！');
          if (this.currentClubProfile) this.currentClubProfile.members = (this.currentClubProfile.members || 0) + 1;
        } else { this.showToast(data.error || '加入失败', 'error'); }
      } catch(e) { this.showToast('加入失败，请重试', 'error'); }
    },
    async submitClubReview() {
      if (!this.requireAuth()) return;
      if (!this.currentClubProfile) return;
      try {
        const res = await fetch('/api/clubs/' + this.currentClubProfile.id + '/review', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ rating: this.clubReviewForm.rating, content: this.clubReviewForm.content })
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '评价失败', 'error'); return; }
        this.showToast('评价已提交 ✅');
        this.clubReviewForm = { rating: 5, content: '' };
        const reviews = await fetch('/api/clubs/' + this.currentClubProfile.id + '/reviews').then(r => r.json()).catch(() => []);
        this.currentClubProfile.reviews_list = reviews;
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async submitActivity() {
      if (!this.requireAuth()) return;
      const clubId = this.getCurrentClubId();
      if (!clubId) {
        this.showToast('未找到可管理的俱乐部，请先完成俱乐部入驻', 'error');
        return;
      }
      if (!this.newActivity.title) { this.showToast('请填写活动标题', 'error'); return; }
      try {
        const res = await fetch('/api/clubs/' + clubId + '/activity', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ ...this.newActivity, price: Number(this.newActivity.price) || 0, max_members: Number(this.newActivity.max_members) || 10 })
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '发布失败', 'error'); return; }
        if (this.currentClubProfile && String(this.currentClubProfile.id) === String(clubId)) {
          if (!this.currentClubProfile.activities) this.currentClubProfile.activities = [];
          this.currentClubProfile.activities.unshift(data);
        }
        this.showToast('活动已发布 ✅');
        this.showPublishActivity = false;
        this.newActivity = { title: '', type: 'activity', mountain: '', region: '', price: '', max_members: 10, start_date: '', end_date: '', difficulty: '', description: '' };
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    bookClubActivity(club, act) {
      this.openActivityEnroll(club, act);
    },

    // Notification center
    async openNotificationCenter() {
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/notifications', { headers: this.getAuthHeaders() });
        if (res.ok) this.notifications = await res.json();
      } catch(e) {}
      this.showNotificationCenter = true;
    },
    async loadUnreadCount() {
      if (!this.authToken) return;
      try {
        // 先尝试新的 /api/notifications/unread 端点，获取通知列表
        const res = await fetch('/api/notifications/unread', { headers: this.getAuthHeaders() });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            this.notifUnreadList = list;
            this.notifUnreadCount = list.length;
            this.notificationCount = list.length;
            return;
          }
        }
        // 降级到旧的 unread-count 端点
        const res2 = await fetch('/api/notifications/unread-count', { headers: this.getAuthHeaders() });
        if (res2.ok) { const d = await res2.json(); this.notificationCount = d.count || 0; this.notifUnreadCount = d.count || 0; }
      } catch(e) {}
    },
    openNotificationPanel() {
      this.notifPanelOpen = true;
      if (this.notifUnreadList.length === 0) this.loadUnreadCount();
    },
    getExpeditionGradient(seed) {
      // 根据名称/id hash 生成渐变颜色（纯 JS，不依赖外部服务）
      let hash = 0;
      const str = String(seed || '');
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      const h1 = Math.abs(hash) % 360;
      const h2 = (h1 + 60) % 360;
      return `linear-gradient(135deg, hsl(${h1},60%,35%), hsl(${h2},70%,25%))`;
    },
    async loadUserStats() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/users/me/stats', { headers: this.getAuthHeaders() });
        if (res.ok) {
          this.userStats = await res.json();
        }
      } catch(e) {}
    },
    async markNotificationRead(n) {
      if (n.is_read) return;
      const prevIsRead = n.is_read;
      const prevNotificationCount = this.notificationCount;
      const prevNotifUnreadCount = this.notifUnreadCount;
      const prevUnreadList = Array.isArray(this.notifUnreadList) ? [...this.notifUnreadList] : [];
      const item = this.notifSettingsList.find(x => x.id === n.id);
      const prevItemIsRead = item ? item.is_read : undefined;
      n.is_read = 1;
      this.notificationCount = Math.max(0, this.notificationCount - 1);
      this.notifUnreadCount = Math.max(0, this.notifUnreadCount - 1);
      // also update in notifSettingsList
      if (item) item.is_read = 1;
      // also update in notifUnreadList
      this.notifUnreadList = this.notifUnreadList.filter(x => x.id !== n.id);
      try {
        const res = await fetch('/api/notifications/' + n.id + '/read', { method: 'PUT', headers: this.getAuthHeaders() });
        if (!res.ok) throw new Error('mark read failed');
      } catch(e) {
        n.is_read = prevIsRead;
        this.notificationCount = prevNotificationCount;
        this.notifUnreadCount = prevNotifUnreadCount;
        this.notifUnreadList = prevUnreadList;
        if (item) item.is_read = prevItemIsRead;
        this.showToast('标记已读失败，请重试', 'error');
      }
    },
    async markAllNotificationsRead() {
      this.notifications.forEach(n => { n.is_read = 1; });
      this.notifSettingsList.forEach(n => { n.is_read = 1; });
      this.notifUnreadList = [];
      this.notificationCount = 0;
      this.notifUnreadCount = 0;
      try {
        await fetch('/api/notifications/read-all', { method: 'PUT', headers: this.getAuthHeaders() });
      } catch(e) {}
    },
    async loadNotifSettingsList() {
      if (!this.authToken) { this.notifSettingsList = []; return; }
      this.notifSettingsLoading = true;
      this.notifSettingsList = [];
      try {
        const res = await fetch('/api/notifications/settings', { headers: this.getAuthHeaders() });
        if (res.ok) {
          this.notifSettingsList = await res.json();
        } else {
          const res2 = await fetch('/api/notifications', { headers: this.getAuthHeaders() });
          if (res2.ok) this.notifSettingsList = await res2.json();
          else this.notifSettingsList = [];
        }
      } catch(e) { this.notifSettingsList = []; }
      this.notifSettingsLoading = false;
    },
    async loadNotifPreferences() {
      if (!this.authToken) return;
      this.notifPreferencesLoading = true;
      try {
        const res = await fetch('/api/notifications/settings', { headers: this.getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') return;
        this.notifPreferences = {
          order_updates: typeof data.order_updates === 'boolean' ? data.order_updates : this.notifPreferences.order_updates,
          booking_updates: typeof data.booking_updates === 'boolean' ? data.booking_updates : this.notifPreferences.booking_updates,
          activity_reminders: typeof data.activity_reminders === 'boolean' ? data.activity_reminders : this.notifPreferences.activity_reminders,
          system_notices: typeof data.system_notices === 'boolean' ? data.system_notices : this.notifPreferences.system_notices,
          marketing: typeof data.marketing === 'boolean' ? data.marketing : this.notifPreferences.marketing,
        };
      } catch(e) {} finally { this.notifPreferencesLoading = false; }
    },
    async saveNotifPreferences() {
      if (!this.authToken) return;
      this.notifPreferencesLoading = true;
      try {
        const res = await fetch('/api/notifications/settings', {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.notifPreferences),
        });
        if (res.ok) this.showToast('通知偏好已保存 ✅');
      } catch(e) {} finally { this.notifPreferencesLoading = false; }
    },
    async submitFeedback() {
      if (!this.feedbackForm.content.trim()) { this.showToast('请填写反馈内容', 'error'); return; }
      this.feedbackSubmitting = true;
      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(this.authToken ? { 'Authorization': 'Bearer ' + this.authToken } : {}) },
          body: JSON.stringify({ type: this.feedbackForm.type, content: this.feedbackForm.content, contact: this.feedbackForm.contact }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const ticketInfo = data && data.ticket_no ? `（工单号：${data.ticket_no}）` : '';
          this.showToast(`反馈已提交，感谢您的意见！✅${ticketInfo}`);
          this.feedbackForm = { type: 'suggestion', content: '', contact: '' };
        } else {
          const d = await res.json().catch(() => ({}));
          this.showToast(d.error || '提交失败，请稍后重试', 'error');
        }
      } catch(e) { this.showToast('网络错误，请稍后重试', 'error'); }
      this.feedbackSubmitting = false;
    },
    confirmBookingFromNotif(n) {
      this.confirmBookingById(n.related_id);
      n.is_read = 1;
    },
    rejectBookingFromNotif(n) {
      this.openRejectBooking(n);
    },
    openRejectBooking(n) {
      this.rejectingNotif = n;
      this.rejectReason = '';
      this.showRejectReason = true;
    },
    async confirmBookingById(bookingId) {
      try {
        const res = await fetch('/api/bookings/' + bookingId + '/confirm', { method: 'PUT', headers: this.getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
          this.showToast('预约已确认 ✅');
          // Update in incomingBookings list
          const idx = this.incomingBookings.findIndex(b => b.id === bookingId);
          if (idx !== -1) this.incomingBookings[idx].status = 'confirmed';
          this.loadUnreadCount();
        } else { this.showToast(data.error || '操作失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async submitRejectBooking() {
      if (!this.rejectingNotif) return;
      const bookingId = (this.rejectingNotif && (this.rejectingNotif.related_id || this.rejectingNotif.id)) || null;
      if (!bookingId) {
        this.showToast('操作失败：无效预约ID', 'error');
        this.showRejectReason = false;
        this.rejectingNotif = null;
        return;
      }
      try {
        const res = await fetch('/api/bookings/' + bookingId + '/reject', {
          method: 'PUT', headers: this.getAuthHeaders(),
          body: JSON.stringify({ reason: this.rejectReason || '对方暂时无法安排' })
        });
        const data = await res.json();
        if (res.ok) {
          this.showToast('预约已拒绝');
          const idx = this.incomingBookings.findIndex(b => b.id === bookingId);
          if (idx !== -1) this.incomingBookings[idx].status = 'rejected';
          this.loadUnreadCount();
        } else { this.showToast(data.error || '操作失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
      this.showRejectReason = false;
      this.rejectingNotif = null;
    },

    // My bookings
    async openMyBookings() {
      if (!this.requireAuth()) return;
      this.myBookingsLoading = true;
      try {
        const res = await fetch('/api/bookings/my', { headers: this.getAuthHeaders() });
        if (res.ok) this.myBookings = await res.json();
        else this.showToast('加载失败，请重试', 'error');
      } catch(e) { this.showToast('加载失败，请重试', 'error'); }
      finally { this.myBookingsLoading = false; }
      this.showMyBookings = true;
    },
    async cancelMyBooking(bookingId) {
      if (!this.requireAuth()) return;
      if (!bookingId) { this.showToast('预约编号无效', 'error'); return; }
      try {
        const res = await fetch('/api/bookings/' + bookingId + '/cancel', {
          method: 'PUT',
          headers: this.getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          this.showToast(data.error || '取消预约失败', 'error');
          return;
        }
        const idx = this.myBookings.findIndex(b => String(b.id) === String(bookingId));
        if (idx !== -1) this.myBookings[idx].status = 'cancelled';
        this.showToast('预约已取消');
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    // Incoming bookings
    async openIncomingBookings() {
      if (!this.requireAuth()) return;
      if (!this.isGuideUser() && !this.isClubAdminUser()) {
        this.showToast('仅向导或俱乐部管理员可查看收到的预约', 'warning');
        return;
      }
      this.incomingBookingsLoading = true;
      try {
        const res = await fetch('/api/bookings/incoming', { headers: this.getAuthHeaders() });
        if (res.ok) this.incomingBookings = await res.json();
        else this.showToast('加载失败，请重试', 'error');
      } catch(e) { this.showToast('加载失败，请重试', 'error'); }
      finally { this.incomingBookingsLoading = false; }
      this.showIncomingBookings = true;
    },

    // ─── Articles / 攻略知识库 ───────────────────────────────────────────────
    async loadArticles() {
      this.articlesLoading = true;
      try {
        let url = '/api/articles';
        if (this.articleCategory && this.articleCategory !== 'all') url += '?category=' + this.articleCategory;
        const res = await fetch(url);
        if (res.ok) this.articles = await res.json();
      } catch(e) {}
      this.articlesLoading = false;
    },
    async openArticleDetail(art) {
      this.selectedArticle = art;
      this.showArticleDetail = true;
      try {
        const res = await fetch('/api/articles/' + art.id);
        if (res.ok) {
          const full = await res.json();
          this.selectedArticle = full;
          // Update view count in list
          const idx = this.articles.findIndex(a => a.id === art.id);
          if (idx !== -1) this.articles[idx].view_count = full.view_count;
        }
      } catch(e) {}
    },
    async likeArticle(art) {
      if (!this.requireAuth()) return;
      if (!art) return;
      try {
        const res = await fetch('/api/articles/' + art.id + '/like', { method: 'POST', headers: this.getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          art.like_count = data.like_count;
          this.showToast('已点赞 ❤️');
        }
      } catch(e) {}
    },

    // ─── Rescue / 全球紧急救援 ──────────────────────────────────────────────
    async loadRescueContacts() {
      try {
        const res = await fetch('/api/rescue/contacts');
        if (res.ok) {
          this.rescueContacts = await res.json();
          const firstPhone = this.rescueContacts?.[0]?.phone || this.rescueContacts?.[0]?.number;
          if (firstPhone) this.sosEmergencyPhone = String(firstPhone);
        }
      } catch(e) {}
    },
    getSosDialNumber() {
      const raw = String(this.sosEmergencyPhone || '').trim();
      if (!raw) return '112';
      const normalized = raw.toLowerCase().startsWith('tel:') ? raw.slice(4) : raw;
      const sanitized = normalized.replace(/[^\d+]/g, '');
      return sanitized || '112';
    },
    closeSOSPanel() {
      this.showSOS = false;
      this.sosStep = 0;
      if (this._sosStatusTimer) clearInterval(this._sosStatusTimer);
      if (this._sosStatusCountdownTimer) clearInterval(this._sosStatusCountdownTimer);
      this._sosStatusTimer = null;
      this._sosStatusCountdownTimer = null;
      this.showSOSConfirm = false;
    },
    getSosStatusLabel(status) {
      if (status === 'processing') return '已响应';
      if (status === 'resolved') return '已处理';
      return '等待响应';
    },
    getSosStatusClass(status) {
      if (status === 'processing') return 'bg-amber-500/20 text-amber-400';
      if (status === 'resolved') return 'bg-emerald-500/20 text-emerald-400';
      return 'bg-red-500/20 text-red-400';
    },
    async loadSosHistory(updateStatus = false) {
      if (!this.authToken) {
        this.sosHistory = [];
        return [];
      }
      try {
        const r = await fetch('/api/rescue/sos/history', { headers: this.getAuthHeaders() });
        if (!r.ok) return this.sosHistory;
        const records = await r.json();
        this.sosHistory = Array.isArray(records) ? records : [];
        if (updateStatus) {
          const latest = this.sosId
            ? this.sosHistory.find((item) => Number(item.id) === Number(this.sosId))
            : this.sosHistory[0];
          if (latest) this.sosStatus = latest.status || 'pending';
          if (this.sosStatus === 'resolved') {
            if (this._sosStatusTimer) clearInterval(this._sosStatusTimer);
            if (this._sosStatusCountdownTimer) clearInterval(this._sosStatusCountdownTimer);
            this._sosStatusTimer = null;
            this._sosStatusCountdownTimer = null;
            this.showToast('救援已完成，您的 SOS 已关闭', 'success');
          }
        }
      } catch (_) {}
      return this.sosHistory;
    },
    async updateSosStatus() {
      if (!this.authToken) return;
      try {
        if (this.sosId) {
          const r = await fetch('/api/rescue/sos/status/' + this.sosId, { headers: this.getAuthHeaders() });
          if (r.ok) {
            const record = await r.json();
            this.sosStatus = record.status || 'pending';
            await this.loadSosHistory(false);
            if (this.sosStatus === 'resolved') {
              if (this._sosStatusTimer) clearInterval(this._sosStatusTimer);
              if (this._sosStatusCountdownTimer) clearInterval(this._sosStatusCountdownTimer);
              this._sosStatusTimer = null;
              this._sosStatusCountdownTimer = null;
              this.showToast('救援已完成，您的 SOS 已关闭', 'success');
            }
            return;
          }
        }
      } catch (_) {}
      await this.loadSosHistory(true);
    },
    startSosStatusPolling() {
      if (this._sosStatusTimer) clearInterval(this._sosStatusTimer);
      if (this._sosStatusCountdownTimer) clearInterval(this._sosStatusCountdownTimer);
      this.sosStatus = 'pending';
      this.sosPollCountdown = 30;
      this.updateSosStatus();
      this._sosStatusTimer = setInterval(async () => {
        this.sosPollCountdown = 30;
        await this.updateSosStatus();
      }, 30000);
      this._sosStatusCountdownTimer = setInterval(() => {
        this.sosPollCountdown = this.sosPollCountdown > 0 ? this.sosPollCountdown - 1 : 0;
      }, 1000);
    },
    startSOSCountdown() {
      this.cancelSOSCountdown(false);
      this.sosCountdown = 5;
      this.showSOSConfirm = true;
      this.sosCountdownTimer = setInterval(() => {
        this.sosCountdown -= 1;
        if (this.sosCountdown <= 0) {
          this.cancelSOSCountdown(false);
          this.triggerSOSAlert();
        }
      }, 1000);
    },
    cancelSOSCountdown(showToast = true) {
      if (this.sosCountdownTimer) {
        clearInterval(this.sosCountdownTimer);
        this.sosCountdownTimer = null;
      }
      this.showSOSConfirm = false;
      if (showToast) this.showToast('已取消SOS');
    },
    async getSOSPosition() {
      const GPS_PRECISION_DECIMALS = 6;
      const GPS_TIMEOUT_MS = 10000;
      const GPS_CACHE_MAX_AGE_MS = 5000;
      if (!navigator.geolocation) {
        this.showToast('GPS不可用，已按空坐标上报', 'warning');
        return { lat: null, lng: null, accuracy: null };
      }
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: Math.round(pos.coords.latitude * (10 ** GPS_PRECISION_DECIMALS)) / (10 ** GPS_PRECISION_DECIMALS),
            lng: Math.round(pos.coords.longitude * (10 ** GPS_PRECISION_DECIMALS)) / (10 ** GPS_PRECISION_DECIMALS),
            accuracy: Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy * 100) / 100
              : null,
          }),
          () => resolve({ lat: null, lng: null, accuracy: null }),
          { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: GPS_CACHE_MAX_AGE_MS }
        );
      });
    },
    async reportSOSAlert(phone, timestamp) {
      const { lat, lng, accuracy } = await this.getSOSPosition();
      const userId = this.currentUser?.id ?? null;
      await fetch('/api/sos/alert', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          userId,
          lat,
          lng,
          accuracy,
          timestamp,
          phone,
        }),
      });
    },
    async triggerSOSAlert() {
      const phone = this.getSosDialNumber();
      const timestamp = new Date().toISOString();
      this.callEmergency(phone);
      this.sosStep = 1;
      this.showSOS = true;
      this.reportSOSAlert(phone, timestamp).catch((e) => {
        console.error('SOS alert reporting failed:', e);
        this.showToast('SOS上报失败，已继续拨号，请口头说明位置', 'warning');
      });
      this.showToast('SOS 已发送！救援正在响应', 'warning');
    },
    async sendSOS() {
      if (!this.sosLocation && !this.sosPeakName && !this.sosMessage) {
        this.showToast('请至少填写位置或求救信息', 'error');
        return;
      }
      this.sosLoading = true;
      const sentAt = new Date().toISOString();
      try {
        const [r1, r2] = await Promise.allSettled([
          fetch('/api/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
            body: JSON.stringify({
              userId: this.currentUser?.id,
              lat: this.sosLocation?.lat ?? null,
              lng: this.sosLocation?.lng ?? null,
              accuracy: this.sosLocation?.accuracy ?? null,
              timestamp: sentAt,
              phone: this.currentUser?.phone,
            }),
          }),
          fetch('/api/rescue/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
            body: JSON.stringify({
              lat: this.sosLocation?.lat ?? null,
              lng: this.sosLocation?.lng ?? null,
              altitude: this.sosLocation?.altitude ?? null,
              peak_name: this.sosPeakName || null,
              message: this.sosMessage || null,
              location: this.sosLocation ? `${this.sosLocation.lat},${this.sosLocation.lng}` : null,
            }),
          }),
        ]);
        const sosAlertOk = r1.status === 'fulfilled' && r1.value.ok;
        const sosRecordOk = r2.status === 'fulfilled' && r2.value.ok;
        if (!sosAlertOk && !sosRecordOk) throw new Error('Both SOS API requests failed');
        this.sosStep = 1;
        this.sosSentAt = sentAt;
        if (r2.status === 'fulfilled' && r2.value.ok) {
          const d = await r2.value.json().catch(() => null);
          this.sosId = d?.record?.id || null;
        } else {
          this.sosId = null;
        }
        await this.loadSosHistory(false);
        this.showToast('🆘 SOS 已发送！救援团队正在响应', 'warning');
        this.startSosStatusPolling();
      } catch(e) {
        this.showToast('发送失败，请重试或直接拨打救援电话', 'error');
      } finally {
        this.sosLoading = false;
      }
    },

    // ─── Customs / 定制攀登 ──────────────────────────────────────────────────
    openCustomsForm() {
      if (!this.requireAuth()) return;
      this.customsSubmitted = false;
      this.customsOrderId = null;
      this.customsForm = { peak_name: '', preferred_date: '', group_size: 1, notes: '', contact_phone: '' };
      this.showCustomsForm = true;
    },
    async submitCustomsOrder() {
      if (!this.customsForm.peak_name || !this.customsForm.contact_phone) {
        this.showToast('请填写山峰名称和联系电话', 'error'); return;
      }
      try {
        const res = await fetch('/api/customs', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify(this.customsForm)
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '提交失败', 'error'); return; }
        this.customsOrderId = data.id;
        this.customsSubmitted = true;
        this.showToast('定制申请已提交 🎉');
      } catch(e) { this.showToast('网络错误', 'error'); }
    },

    // ─── Profile sub-sections ────────────────────────────────────────────────
    async loadMedicalInfo() {
      if (!this.authToken || this.medicalInfoLoaded) return;
      try {
        const res = await fetch('/api/profile/medical', { headers: this.getAuthHeaders() });
        if (res.ok) { this.medicalInfo = await res.json(); this.medicalInfoLoaded = true; }
      } catch(e) {}
    },
    async saveMedicalInfo() {
      if (!this.requireAuth()) return;
      try {
        const res = await fetch('/api/profile/medical', {
          method: 'PUT', headers: this.getAuthHeaders(),
          body: JSON.stringify(this.medicalInfo)
        });
        if (res.ok) { this.medicalInfo = await res.json(); this.showToast('医疗信息已保存 ✅'); }
        else { this.showToast('保存失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async loadEmergencyContacts() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/profile/emergency-contacts', { headers: this.getAuthHeaders() });
        if (res.ok) this.userEmergencyContacts = await res.json();
      } catch(e) {}
    },
    async addEmergencyContact() {
      if (!this.newContact.name || !this.newContact.phone) {
        this.showToast('请填写姓名和电话', 'error'); return;
      }
      try {
        const res = await fetch('/api/profile/emergency-contacts', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify(this.newContact)
        });
        const data = await res.json();
        if (res.ok) {
          this.userEmergencyContacts.push(data);
          this.newContact = { name: '', relationship: '', phone: '' };
          this.showAddContact = false;
          this.showToast('联系人已添加');
        } else { this.showToast(data.error || '添加失败', 'error'); }
      } catch(e) { this.showToast('网络错误', 'error'); }
    },
    async deleteEmergencyContact(id) {
      try {
        const res = await fetch('/api/profile/emergency-contacts/' + id, { method: 'DELETE', headers: this.getAuthHeaders() });
        if (res.ok) {
          this.userEmergencyContacts = this.userEmergencyContacts.filter(c => c.id !== id);
          this.showToast('联系人已删除');
        }
      } catch(e) { this.showToast('操作失败', 'error'); }
    },
    async loadGearChecklist() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/profile/gear-checklist', { headers: this.getAuthHeaders() });
        if (res.ok) this.userGearChecklist = await res.json();
      } catch(e) {}
    },
    async addGearItem() {
      if (!this.newGearItemName.trim()) return;
      try {
        const res = await fetch('/api/profile/gear-checklist', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ item_name: this.newGearItemName.trim() })
        });
        const data = await res.json();
        if (res.ok) {
          this.userGearChecklist.push(data);
          this.newGearItemName = '';
          this.showToast('装备项已添加');
        }
      } catch(e) { this.showToast('操作失败', 'error'); }
    },
    async toggleGearItem(item) {
      const newReady = !item.is_ready;
      item.is_ready = newReady;
      try {
        const res = await fetch('/api/profile/gear-checklist/' + item.id, {
          method: 'PUT', headers: this.getAuthHeaders(),
          body: JSON.stringify({ is_ready: newReady })
        });
        if (!res.ok) item.is_ready = !newReady;
      } catch(e) { item.is_ready = !newReady; }
    },
    async loadFavorites() {
      if (!this.authToken) return;
      try {
        const res = await fetch('/api/profile/favorites', { headers: this.getAuthHeaders() });
        if (res.ok) this.userFavorites = await res.json();
      } catch(e) {}
    },
    async removeFavorite(id) {
      try {
        const res = await fetch('/api/profile/favorites/' + id, { method: 'DELETE', headers: this.getAuthHeaders() });
        if (res.ok) {
          this.userFavorites = this.userFavorites.filter(f => f.id !== id);
          this.showToast('已取消收藏');
        }
      } catch(e) { this.showToast('操作失败', 'error'); }
    },

    // ─── Featured Clubs (Problem 1) ─────────────────────────────────────────
    async loadFeaturedClubs() {
      try {
        const res = await _fetchWithTimeout('/api/clubs/featured');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          if (list.length > 0) {
            this.featuredClubs = list.map(c => ({
              ...c,
              cover: c.cover || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400',
              verified: !!c.verified,
            }));
          } else {
            this.featuredClubs = [];
          }
          this._homeDataLoadedOnce = true;
        } else {
          this.featuredClubs = [];
        }
      } catch(e) {
        if (e && e.name === 'AbortError') {
          this.showToast('网络超时，请检查网络连接', 'warning');
        } else {
          console.warn('[SummitLink] 数据加载失败:', e && e.message ? e.message : e);
          if (!this._homeDataLoadedOnce) this.showToast('数据加载失败，请下拉刷新', 'error');
        }
        if (!Array.isArray(this.expeditionCards)) this.expeditionCards = [];
        if (!Array.isArray(this.nearbyGuides)) this.nearbyGuides = [];
        if (!Array.isArray(this.featuredClubs)) this.featuredClubs = [];
      }
    },

    async loadExpeditions() {
      try {
        const res = await _fetchWithTimeout('/api/expeditions?status=published&limit=6');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (Array.isArray(data?.expeditions) ? data.expeditions : []);
          if (list.length > 0) {
            this.expeditions = list.map(e => ({
              ...e,
              image: e.cover_image || e.image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400',
              peak: e.peak_name || e.peak || '',
              leader: e.guide_name || e.club_name || '',
              leaderAvatar: e.guide_avatar || e.club_cover || 'https://i.pravatar.cc/150?u=guide',
              price: e.base_price ?? e.price ?? 0,
              spots: e.available_spots ?? e.spots ?? 0,
              totalSpots: e.max_members ?? e.total_spots ?? 0,
            }));
          } else {
            this.expeditions = [];
          }
          this._homeDataLoadedOnce = true;
        } else {
          this.expeditions = [];
        }
      } catch(e) {
        if (e && e.name === 'AbortError') {
          this.showToast('网络超时，请检查网络连接', 'warning');
        } else {
          console.warn('[SummitLink] 数据加载失败:', e && e.message ? e.message : e);
          if (!this._homeDataLoadedOnce) this.showToast('数据加载失败，请下拉刷新', 'error');
        }
        this.expeditions = [];
        if (!Array.isArray(this.expeditionCards)) this.expeditionCards = [];
        if (!Array.isArray(this.nearbyGuides)) this.nearbyGuides = [];
        if (!Array.isArray(this.featuredClubs)) this.featuredClubs = [];
      }
    },

    // ─── Commercial Data: Load real guides, clubs, and expedition associations ──
    async loadCommercialData() {
      if (this.commercialDataLoaded) return;
      try {
        // Load approved guides
        const [guidesRes, clubsRes, expRes] = await Promise.allSettled([
          fetch('/api/guides?status=approved&limit=20'),
          fetch('/api/clubs?verified=true&limit=20'),
          fetch('/api/expeditions?status=published&limit=50'),
        ]);

        // Process guides
        if (guidesRes.status === 'fulfilled' && guidesRes.value.ok) {
          const data = await guidesRes.value.json();
          const list = Array.isArray(data) ? data : (data.guides || []);
          this.commercialGuides = list.map(g => {
            const tryParse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch(_) { return []; } };
            return {
              ...g,
              avatar: g.avatar || ('https://i.pravatar.cc/150?u=guide_' + g.id),
              flag: g.flag || '🇨🇳',
              verified: g.status === 'approved',
              peaks_led: tryParse(g.peaks_led) || [],
              specialty: g.specialty || '',
              rating: g.rating || 5.0,
              reviews: g.reviews || 0,
              dayRate: g.day_rate || 0,
              languages: tryParse(g.languages) || ['中文'],
              servicePeaks: (tryParse(g.peaks_led) || []).join('、') || (g.specialty || '多山峰定制服务'),
              priceLabel: (g.day_rate || g.price) ? `¥${Number(g.day_rate || g.price).toLocaleString()}/天` : '价格咨询',
              expeditions: [],
              nextDeparture: null,
              priceFrom: null,
              availableSpots: null,
            };
          });
        }

        // Process clubs
        if (clubsRes.status === 'fulfilled' && clubsRes.value.ok) {
          const data = await clubsRes.value.json();
          const list = Array.isArray(data) ? data : (data.clubs || []);
          this.commercialClubs = list.map(c => ({
            ...c,
            logo: c.logo || c.cover || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=200',
            specialty: c.specialty || '',
            region: c.region || '',
            verified: !!c.verified,
            membersCount: c.members_count || 0,
            expeditions: [],
            nextDeparture: null,
            priceFrom: null,
            availableSpots: null,
            climbPeak: c.specialty || '多条官方山峰路线',
            departureTime: '近期出发',
            priceLabel: '价格咨询',
            quotaLabel: '名额以活动页为准',
          }));
        }

        // Process expeditions and associate with guides/clubs
        if (expRes.status === 'fulfilled' && expRes.value.ok) {
          const data = await expRes.value.json();
          const list = Array.isArray(data) ? data : (data.expeditions || []);
          this.commercialGuideExpeditions = list.filter(e => e.publisher_type === 'guide');
          this.commercialClubExpeditions = list.filter(e => e.publisher_type === 'club');

          // Attach expedition data to each guide
          this.commercialGuides = this.commercialGuides.map(g => {
            const exps = this.commercialGuideExpeditions.filter(e => Number(e.publisher_id) === Number(g.id));
            const sorted = exps.sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0));
            return {
              ...g,
              expeditions: exps,
              nextDeparture: sorted[0] ? sorted[0].start_date : null,
              priceFrom: exps.length ? Math.min(...exps.map(e => Number(e.base_price || e.price || 0))) : null,
              availableSpots: sorted[0] ? (sorted[0].available_spots ?? sorted[0].spots ?? null) : null,
              priceLabel: exps.length ? `起 ¥${Math.min(...exps.map(e => Number(e.base_price || e.price || 0))).toLocaleString()}` : (g.dayRate ? `¥${Number(g.dayRate).toLocaleString()}/天` : '价格咨询'),
            };
          });

          // Attach expedition data to each club
          this.commercialClubs = this.commercialClubs.map(c => {
            const exps = this.commercialClubExpeditions.filter(e => Number(e.publisher_id) === Number(c.id));
            const sorted = exps.sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0));
            const minPrice = exps.length ? Math.min(...exps.map(e => Number(e.base_price || e.price || 0))) : null;
            return {
              ...c,
              expeditions: exps,
              nextDeparture: sorted[0] ? sorted[0].start_date : null,
              priceFrom: minPrice,
              availableSpots: sorted[0] ? (sorted[0].available_spots ?? sorted[0].spots ?? null) : null,
              departureTime: sorted[0] ? sorted[0].start_date : '近期出发',
              priceLabel: minPrice ? `起 ¥${minPrice.toLocaleString()}` : '价格咨询',
              quotaLabel: exps.length ? `${exps.length} 条线路` : '名额以活动页为准',
            };
          });
        }

        this.commercialDataLoaded = true;
      } catch(e) {}
    },

    // ─── Popular Peaks Weather ────────────────────────────────────────────────
    async loadPopularPeaksWeather() {
      try {
        const res = await fetch('/api/weather/popular-peaks');
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) this.popularPeaksWeather = data;
        }
      } catch(e) {}
    },
    openWeatherQuery() {
      this.currentPage = 'explore';
      this.$nextTick(() => {
        const input = document.querySelector('input[x-model="weatherSearch"]');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },
    async togglePopularPeakWeather(peak) {
      if (!peak) return;
      if (this.activePopularPeak && this.activePopularPeak.name === peak.name) {
        this.activePopularPeak = null;
        this.popularPeakWeatherDetail = null;
        return;
      }
      this.activePopularPeak = peak;
      this.popularPeakWeatherLoading = true;
      const detail = enrichPeakDetail({ name: peak.name, altitude: peak.altitude });
      this.popularPeakWeatherDetail = {
        ...detail,
        location: detail.locationDetail || detail.country || '-',
        weather: null,
        advice: '请结合向导建议与装备情况谨慎攀登',
      };
      try {
        const res = await fetch('/api/weather?location=' + encodeURIComponent(peak.name));
        if (res.ok) {
          const weather = await res.json();
          this.popularPeakWeatherDetail = {
            ...this.popularPeakWeatherDetail,
            weather,
            advice: this.buildPopularPeakAdvice(weather),
          };
        }
      } catch (e) {}
      this.popularPeakWeatherLoading = false;
    },
    buildPopularPeakAdvice(weather) {
      if (!weather || weather.error) return '天气服务暂不可用，建议保守决策并确认备用下撤计划。';
      if (Number(weather.wind) >= 45) return '高风速预警，建议暂停冲顶并等待更稳定窗口。';
      if (Number(weather.visibility) <= 3) return '能见度较低，建议缩短行程并加强导航与结组保护。';
      if (Number(weather.temp) <= -25) return '低温风险高，务必加强保暖并控制暴露时间。';
      return '天气相对稳定，可按计划推进，持续监测风速与能见度变化。';
    },

    // ─── Banners (Problem 6) ────────────────────────────────────────────────
    async loadBanners() {
      try {
        const res = await fetch('/api/banners');
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            this.banners = data;
            this.heroSlides = data.map(b => ({
              name: b.title, sub: b.subtitle || '', image: b.image_url,
              linkType: b.link_type, linkTarget: b.link_target, peak: b.peak || b.peak_name || b.link_target,
            }));
          }
        }
      } catch(e) {}
    },
    handleBannerClick(slide) {
      if (!slide.linkType || slide.linkType === 'none') return;
      if (slide.linkType === 'peak') {
        const peakName = slide.peak || slide.name || slide.linkTarget;
        // 先在已加载数据中查找
        const allPeaks = [
          ...(this.eightThousanders || []),
          ...(this.continentalPeaks || []),
          ...(this.worldPeaks || []),
          ...(this.climbingSpots || []),
        ];
        const found = allPeaks.find(p => p.name === peakName || p.nameEn === peakName);
        if (found) {
          this.openPeakDetail(found);
        } else {
          // 找不到时跳转到探索页并加载对应分类
          this.currentPage = 'explore';
          this.activeCategory = '8000ers';
        }
      } else if (slide.linkType === 'page') {
        if (slide.linkTarget === 'guides') {
          this.currentPage = 'explore';
          this.activeCategory = 'commercial';
          this.commercialSourceTab = 'guides';
          this.commercialSubFilter = 'guide';
        } else {
          this.currentPage = slide.linkTarget || 'explore';
        }
      } else if (slide.linkType === 'insurance') {
        this.openInsurance();
      }
    },

    // ─── Insurance (Problem 4) ───────────────────────────────────────────────
    async openInsurance() {
      this.showInsurance = true;
      if (this.insurancePlans.length === 0) await this.loadInsurancePlans();
    },
    async loadInsurancePlans() {
      this.insurancePlansLoading = true;
      try {
        const res = await fetch('/api/insurance/plans');
        if (res.ok) this.insurancePlans = await res.json();
      } catch(e) {}
      this.insurancePlansLoading = false;
    },
    openInsuranceInquiry(plan) {
      if (!this.requireAuth()) return;
      this.selectedInsurancePlan = plan;
      this.insuranceInquiry = { name: this.userProfile.name || '', phone: '', peak_name: '', departure_date: '' };
      this.showInsuranceInquiry = true;
    },
    async submitInsuranceInquiry() {
      if (!this.insuranceInquiry.name || !this.insuranceInquiry.phone) {
        this.showToast('请填写姓名和联系电话', 'error'); return;
      }
      try {
        const res = await fetch('/api/insurance/inquire', {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ ...this.insuranceInquiry, plan_id: this.selectedInsurancePlan?.id })
        });
        const data = await res.json();
        if (res.ok) {
          this.showInsuranceInquiry = false;
          this.showInsurance = false;
          this.showToast('询价已提交，我们将在24小时内联系您 📱');
        } else { this.showToast(data.error || '提交失败', 'error'); }
      } catch(e) { this.showToast('网络错误，请重试', 'error'); }
    },

    // ─── Community Search (Problem 2) ────────────────────────────────────────
    filterCommunityPosts() {
      const q = (this.communitySearchQuery || '').toLowerCase().trim();
      if (!q) { this.filteredCommunityPosts = this.communityPosts; return; }
      this.filteredCommunityPosts = this.communityPosts.filter(p =>
        (p.content && p.content.toLowerCase().includes(q)) ||
        (p.author && p.author.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
      );
    },
    initLocationSocket(expeditionId) {
      if (!expeditionId || !this.authToken) return;
      if (!window.io) {
        this.startExpeditionLocationPolling(expeditionId);
        return;
      }
      if (!this._locationSocket) {
        this._locationSocket = window.io(EXPEDITION_SOCKET_NAMESPACE, {
          auth: { token: this.authToken, userId: this.currentUser?.id },
          query: { userId: this.currentUser?.id },
          transports: ['websocket', 'polling'],
        });
        this._locationSocket.on('connect', () => {
          this.locationConnectionMode = 'ws';
          if (this.selectedTeam?.id) {
            this._locationSocket.emit('join-expedition', this.selectedTeam.id);
          }
          this.stopExpeditionLocationPolling();
        });
        this._locationSocket.on('connect_error', () => {
          this.startExpeditionLocationPolling(this.selectedTeam?.id || expeditionId);
        });
        this._locationSocket.on('disconnect', () => {
          this.startExpeditionLocationPolling(this.selectedTeam?.id || expeditionId);
        });
      }
      this._locationSocket.emit('join-expedition', expeditionId);
      this._locationSocket.off('member-location');
      this._locationSocket.on('member-location', (data) => {
        this.locationConnectionMode = 'ws';
        this.handleMemberLocationUpdate(data);
      });
      if (!this._locationSocket.connected) {
        this.startExpeditionLocationPolling(expeditionId);
      }
    },
    broadcastLocationViaSocket(expeditionId, lat, lng, accuracy, altitude) {
      if (!expeditionId || !this._locationSocket || !this._locationSocket.connected) return false;
      this._locationSocket.emit('location-update', {
        expeditionId,
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        altitude: Number.isFinite(altitude) ? altitude : null,
      });
      return true;
    },
    async reportLocationUpdate(expeditionId, lat, lng, accuracy, altitude) {
      if (!expeditionId || lat == null || lng == null || !this.authToken) return;
      const sentViaSocket = this.broadcastLocationViaSocket(expeditionId, lat, lng, accuracy, altitude);
      if (!sentViaSocket) {
        await fetch('/api/location/update', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            expeditionId,
            lat,
            lng,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            altitude: Number.isFinite(altitude) ? altitude : null,
          }),
        });
      }
    },
    handleMemberLocationUpdate(data) {
      if (!data || !data.userId) return;
      const idx = this.teamMembers.findIndex(m => Number(m.userId) === Number(data.userId));
      const patch = {
        userId: data.userId,
        lat: data.lat,
        lng: data.lng,
        last_seen: new Date(data.timestamp || Date.now()).toISOString(),
      };
      if (idx >= 0) this.teamMembers[idx] = { ...this.teamMembers[idx], ...patch };
      else this.teamMembers.push(patch);
    },
    // ── Capacitor 原生推送 ──────────────────────────────────────
    async initPushNotifications() {
      if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;
      try {
        let PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
        if (!PushNotifications) {
          const mod = await import('@capacitor/push-notifications');
          PushNotifications = mod.PushNotifications;
        }
        if (!PushNotifications) return;
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          console.warn('[Push] 用户拒绝推送权限');
          return;
        }
        await PushNotifications.register();
        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] FCM/APNs token:', token.value);
          try {
            await fetch('/api/push/register-token', {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({
                token: token.value,
                platform: window.Capacitor.getPlatform(),
              }),
            });
          } catch (e) {
            console.warn('[Push] token 上报失败:', e);
          }
        });
        PushNotifications.addListener('registrationError', (err) => {
          console.error('[Push] 注册失败:', err);
        });
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[Push] 收到推送:', notification);
          this.showToast(notification.body || notification.title || '新消息', 'info');
        });
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[Push] 点击推送:', action);
          const data = action.notification?.data || {};
          if (data.page) this.currentPage = data.page;
        });
        console.log('[Push] 原生推送初始化完成');
      } catch (e) {
        console.warn('[Push] 原生推送初始化失败（可能在 Web 环境）:', e);
      }
    },
    applySystemTheme() {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('al_theme', theme);
      this.syncStatusBar(theme);
    },
    async syncStatusBar(theme) {
      if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
      const StatusBar = window.Capacitor?.Plugins?.StatusBar;
      if (!StatusBar) return;
      const rootStyles = window.getComputedStyle(document.documentElement);
      const statusBarColor = ((rootStyles.getPropertyValue('--color-status-bar-bg') || rootStyles.getPropertyValue('--bg-primary') || '')).trim();
      try {
        await StatusBar.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' });
        if (StatusBar.setBackgroundColor && statusBarColor) {
          await StatusBar.setBackgroundColor({ color: statusBarColor });
        }
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta && statusBarColor) {
          themeMeta.setAttribute('content', statusBarColor);
        }
      } catch (e) {}
    },
    async refreshBiometricAvailability() {
      try {
        if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
          this.showBiometricLogin = false;
          return;
        }
        const BiometricAuth = window.Capacitor?.Plugins?.BiometricAuth;
        const available = BiometricAuth && BiometricAuth.isAvailable ? await BiometricAuth.isAvailable() : null;
        this.showBiometricLogin = !!(available && available.isAvailable !== false);
      } catch (e) {
        this.showBiometricLogin = false;
      }
    },

    async init() {
      try {
        const metaStripeKey = (document.querySelector('meta[name="stripe-publishable-key"]')?.content || '').trim();
        if (metaStripeKey) this.stripePublishableKey = metaStripeKey;
        await this.initLang();
        this.initErrorHandling();
        await this.initPerfMonitor();
        this.applySystemTheme();
        if (window.matchMedia) {
          const media = window.matchMedia('(prefers-color-scheme: dark)');
          const onThemeChange = () => this.applySystemTheme();
          if (media.addEventListener) media.addEventListener('change', onThemeChange);
          else if (media.addListener) media.addListener(onThemeChange);
        }
        await this.refreshBiometricAvailability();
        // Auto-rotate hero carousel every 5 seconds
        setInterval(() => {
          this.heroSlide = (this.heroSlide + 1) % this.heroSlides.length;
        }, 5000);
        // 监听 JWT 过期事件，统一提示并跳转登录（Phase 0.5）
        const onSessionExpired = () => {
          this.authToken = null;
          this.currentUser = null;
          if (this._wasLoggedIn) {
            this._wasLoggedIn = false;
            this.showToast('登录已过期，请重新登录', 'warning');
          }
          this.showLogin = true;
        };
        window.addEventListener('summitlink:session-expired', onSessionExpired);
        if (typeof this.$cleanup === 'function') {
          this.$cleanup(() => window.removeEventListener('summitlink:session-expired', onSessionExpired));
        }
        await this.loadPublicConfig();
        if (this.paymentsEnabled) {
          try {
            await this.ensureStripeLoaded();
          } catch (e) {
            console.warn('[payments] Stripe SDK load skipped:', e && e.message ? e.message : e);
          }
        }
        // Initialize public tracks
        this.filteredPublicTracks = this.publicTracks;
        // Verify token and load initial data
        if (this.authToken) { this._wasLoggedIn = true; }
        this.verifyToken();
        this.loadPeaks('8000ers');
        this.loadGuides();
        this.loadTeams();
        this.loadGear('buy');
        this.loadPosts().then(() => { this.filteredCommunityPosts = this.communityPosts; });
        this.loadWeather();
        this.loadClubs();
        this.loadFeaturedClubs();
        this.loadExpeditions();
        this.loadBanners();
        this.loadPopularPeaksWeather();
        this.loadRescueContacts();
        this.loadConversations();
        // Load notification count after token verify
        this.$watch('authToken', (val) => {
          if (val) { this.loadUnreadCount(); this.loadTracks(); this.loadConversations(); this.initChatSocket(); this.loadInviteInfo(); }
        });
        if (this.authToken) { this.loadUnreadCount(); this.loadTracks(); this.loadInviteInfo(); }
        // Phase 2.3: 页面加载时同步待上传轨迹；网络恢复时也自动触发
        idbGetPendingTracks().then(t => { this.pendingUploadCount = t.length; }).catch(() => {});
        this.syncPendingTracks();
        window.addEventListener('online', () => this.syncPendingTracks());
        window.addEventListener('online', () => { this.isOffline = false; });
        window.addEventListener('offline', () => { this.isOffline = true; });
        // Phase 2.5: 检测地图引擎，Mapbox 时懒加载 SDK
        detectMapProvider().then(cfg => {
          if (cfg.provider === 'mapbox' && cfg.token) {
            loadMapboxGL(cfg.token).catch(() => {});
          } else if (cfg.provider === 'osm') {
            window.__osmTileUrl = cfg.tileUrl;
            window.__osmAttribution = cfg.attribution;
            console.warn('[map] MAPBOX_TOKEN not configured, falling back to OSM. Configure MAPBOX_TOKEN in Railway Variables before 5/15 launch.');
            loadLeaflet().catch(() => {});
          }
        });
        // Watch gearMode changes to reload gear (reset category first to avoid double-call)
        this.$watch('gearMode', (val) => {
          if (this.gearCategory !== '全部') {
            this.gearCategory = '全部'; // triggers gearCategory watch → loadGear
          } else {
            this.loadGear(val); // category unchanged, load manually
          }
        });
        // Watch gearCategory changes to reload gear
        this.$watch('gearCategory', (val) => this.loadGear(this.gearMode, val));
        // Watch activeCategory changes to reload peaks
        this.$watch('activeCategory', (val) => {
          if (['8000ers','continental','world','alpine'].includes(val)) this.loadPeaks(val);
          if (val === 'commercial') {
            this.loadGuides();
            this.loadClubs();
            this.loadCommercialData();
          }
        });
        // 初始化时主动加载默认分类数据
        this.loadPeaks(this.activeCategory);
        // Watch activeChatType to load articles when articles tab is selected
        this.$watch('activeChatType', (val) => {
          if (val === 'articles' && this.articles.length === 0) this.loadArticles();
        });
        // Watch communityPosts to sync filteredCommunityPosts
        this.$watch('communityPosts', (val) => { this.filteredCommunityPosts = val; });
        // Handle shared track URL: /summitlink?track=ID
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = (urlParams.get('invite') || '').trim().toUpperCase();
        if (inviteCode) {
          this.registerForm.inviteCode = inviteCode;
          this.showInviteCodeInput = true;
          this.showRegister = true;
        }
        const sharedTrackId = urlParams.get('track');
        if (sharedTrackId) {
          this.$nextTick(async () => {
            try {
              const res = await fetch('/api/tracks/' + sharedTrackId);
              if (res.ok) {
                const track = await res.json();
                this.currentPage = 'home';
                await this.$nextTick();
                this.openTrackDetail(track);
              }
            } catch(e) {}
          });
        }
        // Handle payment result URL: /summitlink?payment=success&orderId=xxx
        const paymentResult = urlParams.get('payment');
        if (paymentResult === 'success') {
          const payOrderId = urlParams.get('orderId');
          this.$nextTick(() => {
            this.showToast('支付成功！订单' + (payOrderId ? ' #' + payOrderId : '') + ' 已完成 🎉');
            // 自动刷新预约列表
            if (this.authToken) {
              setTimeout(() => { try { this.loadMyOrders(); } catch(_) {} }, 500);
            }
          });
        }
        this.initPushNotifications();
      } catch (err) {
        console.error('[SummitLink] init() 崩溃：', err);
        this._initError = true;
        this._initErrorMsg = (err && err.message) ? err.message : String(err);
      }
    },
    async loadPublicConfig() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const data = await res.json();
        this.paymentsEnabled = !!data.paymentsEnabled;
        this.stripePublishableKey = (data.stripePublishableKey || '').trim()
          || (document.querySelector('meta[name="stripe-publishable-key"]')?.content || '').trim()
          || (window.__STRIPE_PUBLISHABLE_KEY__ || '').trim();
        this.sosEmergencyPhone = String(data.emergencyPhone || '112').trim();
      } catch (e) {}
    },
    async ensureStripeLoaded() {
      if (!this.paymentsEnabled) return null;
      const key = (this.stripePublishableKey || '').trim();
      if (!key) return null;
      if (this.stripeClient) return this.stripeClient;
      if (window.Stripe) {
        this.stripeClient = window.Stripe(key);
        this.stripeLoadPromise = Promise.resolve(this.stripeClient);
        return this.stripeClient;
      }
      if (!this.stripeLoadPromise) {
        this.stripeLoadPromise = new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-sdk="stripe-v3"]');
          if (existing) {
            if (window.Stripe) { resolve(); return; }
            if (existing.getAttribute('data-loaded') === 'true') {
              reject(new Error('Stripe SDK script loaded but window.Stripe is unavailable.'));
              return;
            }
            if (existing.getAttribute('data-failed') === 'true') {
              reject(new Error('Stripe SDK script is not available.'));
              return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Stripe SDK failed to load.')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          script.setAttribute('data-sdk', 'stripe-v3');
          script.setAttribute('data-loading', 'true');
          script.onload = () => {
            script.setAttribute('data-loading', 'false');
            script.setAttribute('data-loaded', 'true');
            resolve();
          };
          script.onerror = () => {
            script.setAttribute('data-loading', 'false');
            script.setAttribute('data-failed', 'true');
            reject(new Error('Stripe SDK failed to load.'));
          };
          document.head.appendChild(script);
        });
      }
      try {
        await this.stripeLoadPromise;
      } catch (e) {
        this.stripeLoadPromise = null;
        throw e;
      }
      if (!window.Stripe) {
        this.stripeLoadPromise = null;
        return null;
      }
      this.stripeClient = window.Stripe(key);
      this.stripeLoadPromise = Promise.resolve(this.stripeClient);
      return this.stripeClient;
    },
  };
}

if (typeof window !== 'undefined') {
  window.alpineLink = alpineLink;
  window.__SUMMITLINK_APP_CORE_BUILD__ = '2026-05-26-syntax-hotfix-3';
}
