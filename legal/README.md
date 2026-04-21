# legal/ 目录说明

本目录包含"巅峰探索 SummitLink"平台的法律文本草稿，供营业执照下发后由法务部门最终审定使用。

---

## 文件列表

| 文件 | 说明 | 状态 |
|------|------|------|
| [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) | 用户隐私政策（中文，适用于中国大陆用户）| 草稿，待法务审定 |
| [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md) | 用户服务协议（中文）| 草稿，待法务审定 |
| [`DATA_PROCESSING.md`](./DATA_PROCESSING.md) | 数据处理说明（App 上架材料）| 草稿，待法务审定 |

---

## 占位符替换说明

文档中所有 `{{占位符}}` 在正式上线前必须替换为真实信息：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{{COMPANY_NAME}}` | 公司全称（与营业执照一致）| `北京xxx科技有限公司` |
| `{{ICP_NUMBER}}` | ICP 备案号 | `京ICP备2026XXXXXX号` |
| `{{CONTACT_EMAIL}}` | 隐私政策联系邮箱 | `privacy@summitlink.cn` |
| `{{COMPANY_ADDRESS}}` | 公司注册地址 | `北京市xxx区xxx路x号` |
| `{{COMPANY_LOCATION}}` | 用于约定管辖法院的城市 | `北京市` |

**替换步骤：**

1. 营业执照下发后，填入 `{{COMPANY_NAME}}`、`{{COMPANY_ADDRESS}}`
2. 完成 ICP 备案后，填入 `{{ICP_NUMBER}}`
3. 注册合规联系邮箱，填入 `{{CONTACT_EMAIL}}`
4. 经法务审定后，将 Markdown 转为 HTML 页面部署到生产环境

---

## 与业务层的对接方式

### 1. 登录/注册页同意勾选

在用户注册时，需展示并要求用户明确勾选同意：

```html
<!-- 示例 HTML 片段（需集成到注册表单）-->
<label>
  <input type="checkbox" required name="agree_terms" />
  我已阅读并同意
  <a href="/legal/terms" target="_blank">《用户服务协议》</a>
  和
  <a href="/legal/privacy" target="_blank">《隐私政策》</a>
</label>
```

对应后端接口：注册时记录用户同意的协议版本号和时间戳。

### 2. 隐私政策页面部署

建议在产品正式上线前：

1. 将 `PRIVACY_POLICY.md` 内容渲染为前端页面，路径为 `/legal/privacy`
2. 将 `TERMS_OF_SERVICE.md` 内容渲染为前端页面，路径为 `/legal/terms`
3. 在 App 的"关于"和"设置"页面提供跳转链接

### 3. App 上架材料

- **iOS App Store**：在开发者后台 App 信息中填写隐私政策 URL，并填写数据收集问卷（与 `DATA_PROCESSING.md` 对应）
- **各 Android 应用市场**：上传 `PRIVACY_POLICY.md` 对应的 PDF 版本

---

## 重要提示

> ⚠️ 本目录中的文档均为**草稿**，不构成正式法律文件。请在营业执照下发后，联系专业法律顾问对上述文档进行审查和修订，确保符合以下法规要求：
>
> - 《中华人民共和国个人信息保护法》
> - 《中华人民共和国数据安全法》
> - 《中华人民共和国网络安全法》
> - 《互联网用户账号信息管理规定》
> - App 专项治理工作组发布的相关规范
