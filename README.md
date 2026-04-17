# Welcome to GitHub Desktop!

This is your README. READMEs are where you can communicate what your project is and how to use it.

Write your name on line 6, save it, and then head back to GitHub Desktop.

## 新功能

### 1. 全球热门商业向导带队攀登雪山统计

在「探索山峰」页面新增了「**商业攀登**」标签页，展示全球 30 座主流商业向导公司带队攀登的热门雪山。

- **数据内容**：涵盖 8000 米级、7000 米级、6000 米级及中国热门商业山峰，每座山峰包括：名称（中英文）、海拔、所在国家/山系、主要商业运营商、年均攀登人数（带「估算」标注）、最佳季节、常见路线、是否使用辅助氧气、难度等级。
- **顶部图表**：展示年攀登人数 Top 10 的柱状图，直观了解各山峰商业热度。
- **筛选排序**：支持按地区、难度筛选，以及按海拔/年攀登人数排序。
- **营地天气直达**：每座配置了营地坐标的山峰下方有「查看营地天气」按钮，点击后直接调起营地分层天气。

### 2. 修复营地天气 C2 与 C3 数据相同的问题

- **根因**：部分山峰的 C2 与 C3 营地坐标相差过小（< 0.01°），落到了天气 API 同一格点，导致返回数据一致。
- **修复**：重新调整了「道拉吉里峰、马纳斯卢峰、南迦帕尔巴特峰、安纳普尔纳峰、加舒尔布鲁姆 I/II 峰、布洛阿特峰、K2、干城章嘉峰」等多座山峰各营地的经纬度，确保相邻营地间距 ≥ 0.01°。
- **UI 说明**：若两个营地因格点确实接近而天气相同，界面上会显示「⚠ 因格点接近，天气数据相同」提示，避免用户误以为是数据 bug。
- 每个营地 DOM 节点带有 `data-camp` 属性标识（值为营地名称），便于自动化测试验证独立性。

### 3. 集成 OpenStreetMap Nominatim 地名查询

- **解决了「城市/山峰查不到」的问题**：当内置坐标库和 OpenWeather 均无法匹配时，自动 fallback 到 OpenStreetMap Nominatim 解析地名，再用坐标请求天气。
- **下拉候选**：天气搜索框输入时（≥2 个字符），经过 500ms 防抖后，从 Nominatim 拉取 Top 5 候选，显示下拉选择。
- **节流与缓存**：请求间隔 ≥ 1s；结果缓存到 `localStorage`，7 天内复用，减少对 Nominatim 的压力。
- **友好提示**：当 Nominatim 也找不到时，提示：「未找到该地点，请尝试使用英文名或更具体的名称（例如 "Mount Everest Base Camp, Nepal"）」。

### 相关文件

| 文件 | 变更说明 |
|------|---------|
| `攀登4-20260416-summitlink.html` | 新增商业攀登模块 UI、营地天气 data-camp 属性、OSM geocoding 函数及下拉 |
| `backend/routes/weather.js` | 修正多座山峰营地坐标，使 C2/C3 落到不同天气格点 |
| `tests/commercial-peaks.spec.js` | 新增 Playwright 测试：商业峰模块渲染、C2/C3 独立节点、geocodeByOSM 函数存在性 |

