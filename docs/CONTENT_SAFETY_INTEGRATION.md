# 阿里云内容安全 SDK 集成指南

## 概述

本文档说明如何在生产环境中启用阿里云内容安全图片审核功能。框架代码已就绪（`backend/middleware/contentSafety.js`），只需配置环境变量并接入 SDK 即可。

---

## 当前状态

| 环境 | 行为 |
|------|------|
| 开发 / 测试 (`NODE_ENV !== 'production'`) | 直接放行，不调用 API |
| 生产（未配置 `ALIYUN_ACCESS_KEY_ID`） | 直接放行，不调用 API |
| 生产（已配置 `ALIYUN_ACCESS_KEY_ID`） | 调用阿里云内容安全 API 审核图片 |

---

## 配置步骤

### 1. 开通阿里云内容安全服务

1. 登录 [阿里云控制台](https://console.aliyun.com)
2. 搜索「内容安全」→ 开通「图片同步检测」服务
3. 在 RAM 控制台创建专用 AccessKey（建议单独授权 `green:*`）

### 2. 安装阿里云内容安全 SDK

```bash
cd backend
npm install @alicloud/green20220302
```

### 3. 配置环境变量

在 Railway（或本地 `.env`）中添加：

```env
ALIYUN_ACCESS_KEY_ID=<你的 AccessKey ID>
ALIYUN_ACCESS_KEY_SECRET=<你的 AccessKey Secret>
ALIYUN_GREEN_ENDPOINT=green.cn-shanghai.aliyuncs.com
```

> ⚠️ **不要将 AccessKey 提交到代码仓库**。

### 4. 取消注释 SDK 调用代码

编辑 `backend/middleware/contentSafety.js`，取消注释 SDK 调用部分：

```js
const checkImageSafety = async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.ALIYUN_ACCESS_KEY_ID) {
    return next();
  }
  try {
    const Green = require('@alicloud/green20220302');
    const client = new Green.default({
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      endpoint: process.env.ALIYUN_GREEN_ENDPOINT || 'green.cn-shanghai.aliyuncs.com',
    });

    // 从请求中获取图片 URL 或 Base64
    const imageUrl = req.body.imageUrl || (req.file ? `/uploads/${req.file.filename}` : null);
    if (!imageUrl) return next();

    const result = await client.imageSync({
      tasks: [{ dataId: 'img-' + Date.now(), url: imageUrl }],
      scenes: ['porn', 'terrorism'],
    });

    const suggestion = result?.body?.data?.[0]?.results?.[0]?.suggestion;
    if (suggestion === 'block') {
      return res.status(400).json({ error: '图片内容违规，上传被拒绝' });
    }

    next();
  } catch (err) {
    console.error('[contentSafety] 审核失败，放行：', err.message);
    next(); // 审核失败时放行，不阻断用户流程
  }
};
```

---

## 挂载点

`checkImageSafety` 已挂载到以下接口：

| 接口 | 中间件链 |
|------|---------|
| `POST /api/upload` | `uploadLimiter → auth → checkImageSafety → uploadHandler` |
| `POST /api/upload/multiple` | `uploadLimiter → auth → checkImageSafety → uploadHandler` |

---

## 审核策略说明

| 场景 | 阿里云 suggestion | 处理方式 |
|------|-----------------|---------|
| 图片合规 | `pass` | 放行 |
| 需人工审核 | `review` | 放行（可选：记录日志后台复审） |
| 违规图片 | `block` | 返回 `400 { error: '图片内容违规' }` |
| SDK 调用失败 | - | 放行，记录错误日志（不阻断用户） |

---

## 参考资料

- [阿里云内容安全产品文档](https://help.aliyun.com/product/28415.html)
- [图片同步检测 API 参考](https://help.aliyun.com/document_detail/70292.html)
- [@alicloud/green20220302 NPM](https://www.npmjs.com/package/@alicloud/green20220302)
