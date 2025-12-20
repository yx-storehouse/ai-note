<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1rCP8XZr-IA9nA47q6JGjMXhcvlR8KFOe

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. **配置 API Key（首次使用）**：
   - 打开应用后，点击右上角的设置图标
   - 在设置界面中，输入你的 **MIMO API Key**
   - （可选）如果需要自定义 API 端点，可以填写 API Endpoint
   - **开发环境**：会自动使用 Vite 代理 (`/api/mimo`)，解决 CORS 问题
   - **生产环境**：默认使用 `https://api.xiaomimimo.com/v1/chat/completions`
   - API Key 会自动保存到浏览器本地存储中，下次打开会自动加载
   
   ⚠️ **注意**：如果生产环境遇到 CORS 跨域错误，请参考下面的"解决 CORS 问题"章节

4. **配置 Gitee 同步（可选）**：
   - 在设置界面中，输入 Gitee Access Token 和 Gist ID
   - 这些信息也会保存在浏览器本地

## Deploy to Cloudflare Pages

这个项目可以直接部署到 Cloudflare Pages。

### 部署步骤：

1. **准备代码仓库**
   - 将代码推送到 GitHub 或 GitLab

2. **在 Cloudflare Pages 中创建项目**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 **Pages** → **Create a project**
   - 连接你的 Git 仓库

3. **配置构建设置**
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (项目根目录)

4. **无需配置环境变量**
   - ✅ 现在 API Key 通过前端页面输入，存储在用户浏览器本地
   - ✅ 每个用户使用自己的 API Key，不会在代码中暴露
   - ✅ 支持用户级别的 API Key 管理，更加安全

5. **部署**
   - 点击 **Save and Deploy**
   - Cloudflare Pages 会自动构建并部署你的应用

### 注意事项：

- ✅ 项目使用 Vite 构建，默认输出到 `dist` 目录
- ✅ 所有 API 调用都在客户端进行（小米 MIMO API 和 Gitee API）
- ✅ API Key 通过前端页面输入，存储在浏览器 localStorage 中，不会在代码中暴露
- ✅ 每个用户使用自己的 API Key，支持用户级别的配置管理
- ✅ 支持自动部署：每次推送到主分支会自动触发部署

### 数据存储说明：

- **API Key**: 存储在浏览器 `localStorage` 中，键名为 `smart-notes-api-config`
- **Gitee Token**: 存储在浏览器 `localStorage` 中，键名为 `smart-notes-gitee-config`
- **笔记数据**: 存储在浏览器 `localStorage` 中，键名为 `smart-notes-data`
- 所有数据都保存在用户本地浏览器中，不会上传到服务器

### 解决 CORS 跨域问题

由于浏览器安全策略，前端直接调用 MIMO API 可能会遇到 CORS 跨域问题。

#### 开发环境（已自动解决）
- ✅ 项目已配置 Vite 代理，开发环境会自动使用 `/api/mimo` 代理
- ✅ 无需额外配置，直接运行 `npm run dev` 即可

#### 生产环境解决方案

**方案 1：使用 Cloudflare Workers 代理（推荐）**

1. 在 Cloudflare Dashboard 中创建新的 Worker
2. 将项目根目录下的 `cloudflare-worker-proxy.js` 代码复制到 Worker 编辑器
3. 保存并部署 Worker
4. 在应用设置中将 API Endpoint 设置为你的 Worker URL，例如：
   ```
   https://your-worker-name.your-subdomain.workers.dev/api/mimo
   ```

**方案 2：使用其他代理服务**
- 可以使用任何支持 CORS 的代理服务
- 在设置中配置代理 URL 作为 API Endpoint

**方案 3：后端代理**
- 如果你有自己的后端服务器，可以在后端设置代理转发请求
