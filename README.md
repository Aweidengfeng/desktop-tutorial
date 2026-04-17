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

### 4. 地图 API 切换为高德 Web JS API

- **轨迹地图**：「轨迹」页的 GPS 占位图替换为高德真实地图，支持实时定位（`AMap.Geolocation`）和轨迹 polyline 显示。
- **坐标转换**：后端 `tracks.points` 仍以 WGS84（`{lat, lng, ele, ts}`）存储，前端通过 `AMap.convertFrom` 将 GPS 坐标转为 GCJ-02 再绘制。
- **`initAMap(containerId, options)` 工具函数**：所有地图场景统一调用，已封装到 Alpine.js 全局 data 中。

> ⚠️ **上线前必须替换地图 Key**：
>
> 1. 前往 [https://console.amap.com/dev/key/app](https://console.amap.com/dev/key/app) 注册并申请一个 **Web 端（JS API）** 类型的 Key（个人认证免费）。
> 2. 打开 `攀登4-20260416-summitlink.html`，将第 17 行中的 `YOUR_AMAP_KEY` 替换为你的真实 Key：
>    ```html
>    <script src="https://webapi.amap.com/maps?v=2.0&key=YOUR_AMAP_KEY"></script>
>    ```
> 3. 开发环境可在高德控制台将本地域（如 `localhost`）加入白名单。

### 5. 探索模块去预约

- 「探索山峰」页面的商业攀登模块**移除了「立即预约」按钮**，专注于路线介绍/图文展示。
- 「向导」卡片上的「预约」按钮同样移除，点击卡片可查看向导详情，通过「私信向导」联系。
- 所有付款/下单流程统一走底部导航「商业攀登」独立入口。

### 6. 聊天发图

- 聊天输入栏新增「📷 图片」按钮，支持多选图片；发送前可预览，点 × 删除。
- 消息结构新增 `type`（`text` / `image` / `mixed`）和 `images: []` 字段。
- 图片上传走 `POST /api/upload`（multer 多图）；消息气泡自动渲染图片，点击可全屏预览（Lightbox）。

### 7. 社区发图/评论发图

- 发帖编辑器「照片」按钮改为真实文件选择，支持多图预览与上传；帖子表新增 `images TEXT JSON` 字段。
- 评论区同样支持带图评论（照片按钮 + 预览）；评论表新增 `images TEXT JSON` 字段。
- 帖子列表正确渲染多图九宫格（最多显示 9 张），超出显示 `+N`；点击图片全屏预览。

### 相关文件

| 文件 | 变更说明 |
|------|---------|
| `攀登4-20260416-summitlink.html` | AMap 脚本引入、轨迹地图容器、去预约、聊天/帖子/评论图片上传与渲染、Lightbox、AMap工具函数 |
| `backend/app.js` | 注册 `/api/upload` 路由、挂载 `/uploads` 静态目录 |
| `backend/routes/upload.js` | 新增 multer 多图上传接口 |
| `backend/routes/messages.js` | 消息接口支持 `type` 和 `images` 字段 |
| `backend/routes/posts.js` | 帖子接口支持 `images` 字段 |
| `backend/routes/comments.js` | 评论接口支持 `images` 字段 |
| `backend/routes/tracks.js` | 轨迹接口支持 `points` 字段（WGS84 JSON） |
| `backend/db/database.js` | 迁移：messages/posts/comments 表加 `images`，messages 加 `type`，tracks 加 `points` |
| `backend/package.json` | 新增依赖 `multer` |

