# 智能笔记 AI

把杂乱的原始文本（服务器信息、命令、账号密码、链接……）粘贴进来，由小米 MiMo 大模型自动拆分成结构化笔记：标题、摘要、分类、标签、关键字段和代码块。笔记保存在浏览器本地，可选通过 Gitee Gist 在多台设备间同步。

## 功能

- **AI 整理**：一段文本自动拆成多条笔记，提取 IP / 端口 / 密码等字段，密码类字段默认模糊显示
- **检索**：搜索标题、摘要、标签、字段和代码块；按分类或点击标签筛选；手机端有分类标签栏
- **编辑**：修改所有内容，包括代码块、「代码 / 敏感」标记，并可查看 AI 分析前的原始文本
- **置顶与排序**：按「最近创建 / 最近更新」排序，置顶的笔记始终在最前
- **撤销**：删除笔记、从云端恢复、导入备份之后都可以撤销
- **云同步**：Gitee Gist 存储，能识别出另一台设备改过云端数据，不会静默覆盖
- **安全**：AI Key 和 Gitee Token 只保存在 Cloudflare Worker 中，接口需要访问密码

### 快捷键

| 按键 | 作用 |
| --- | --- |
| `/` | 聚焦搜索框 |
| `Ctrl/⌘ + Enter` | 在输入框中开始分析 / 在编辑框中保存 |
| `Esc` | 关闭最上层的弹窗；在搜索框中清空搜索 |

## 架构

```
浏览器 (React SPA)  ──/api/*  + Authorization: Bearer <APP_PASSWORD>──▶  Cloudflare Worker
  └─ localStorage 存放笔记                                                 ├─ POST /api/analyze ─▶ 小米 MiMo
                                                                           └─ GET/PUT /api/sync ─▶ Gitee Gist
```

- 前端：React 19 + Vite 6 + Tailwind CSS 4（`src/`）
- 后端：一个 Cloudflare Worker（`worker/`），同时托管静态资源
- 共享：类型定义和数据整理逻辑（`shared/`）

## 本地开发

需要 Node.js 22.12+。

```bash
npm install
cp .dev.vars.example .dev.vars   # 填写 APP_PASSWORD 和 MIMO_API_KEY
npm run dev                      # http://localhost:3000
```

`npm run dev` 会通过 `@cloudflare/vite-plugin` 在本地运行真实的 Worker，行为与线上一致。打开页面后，第一次使用 AI 分析时会要求输入 `.dev.vars` 里的 `APP_PASSWORD`。

想用手机访问局域网中的开发服务器时，运行 `npm run dev -- --host`。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run typecheck` | 类型检查（前端、Worker、配置文件） |
| `npm test` | 单元测试（Vitest） |
| `npm run build` | 构建到 `dist/` |
| `npm run preview` | 本地预览构建结果（同样会运行 Worker） |
| `npm run check` | 依次运行类型检查、测试和构建 |
| `npm run deploy` | 构建并部署到 Cloudflare |

## 部署到 Cloudflare Workers

### 方式一：连接 Git 仓库自动部署（推荐）

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 中进入 **Workers & Pages → Create → Import a repository**，选择本仓库
2. 构建设置：
   - **Build command**：`npm run build`
   - **Deploy command**：`npx wrangler deploy`
3. 在 **Settings → Variables and Secrets** 中添加下面的变量，然后重新部署

### 方式二：本地命令行部署

```bash
npx wrangler login
npx wrangler secret put APP_PASSWORD
npx wrangler secret put MIMO_API_KEY
npx wrangler secret put GITEE_TOKEN      # 可选
npm run deploy
```

### 环境变量

| 名称 | 必需 | 说明 |
| --- | --- | --- |
| `APP_PASSWORD` | ✅ | 访问密码（建议设为 Secret）。**未设置时所有 `/api/*` 接口返回 503** |
| `MIMO_API_KEY` | ✅ | 小米 MiMo API Key（Secret） |
| `MIMO_MODEL_NAME` | | 模型名称，默认 `mimo-v2.6-flash`，可选 `mimo-v2.6-pro` 等（见 [模型列表](https://mimo.mi.com/docs/en-US/api/model/list-models)） |
| `GITEE_TOKEN` | | Gitee 私人令牌（Secret，需要 `gists` 权限），设置后启用云同步 |
| `GITEE_GIST_ID` | | 存放笔记的 Gist ID。留空时首次上传会自动创建，页面会提示新建的 ID，请把它填回这里 |
| `MIMO_API_URL` / `GITEE_API_BASE` | | 覆盖上游接口地址，一般不需要 |

`wrangler.toml` 中设置了 `keep_vars = true`，用 `wrangler deploy` 部署不会清掉 Dashboard 里配置的明文变量。

### 安全建议

- 笔记里常有服务器密码，`APP_PASSWORD` 请使用足够长的随机字符串
- 可以在 Cloudflare **Security → WAF → Rate limiting rules** 中给 `/api/*` 加一条限流规则（免费套餐包含一条），防止暴力猜测密码
- 访问密码只保存在你自己的浏览器中，可以在「设置 → 访问密码」中清除

## 数据存储与同步

- 笔记保存在浏览器 `localStorage`（键名 `smart-notes-data`），查看、编辑、搜索都不需要联网，也不需要密码
- 云同步保存的是全部笔记的快照，存放在 Gist 的 `smart_notes.json` 中，格式为 `{ "version": 2, "updatedAt": ..., "notes": [...] }`。旧版本的纯数组格式仍然可以读取
- 打开应用并解锁后会比较本地和云端：
  - 本地为空：自动加载云端数据
  - 只有一边有修改：提示上传或恢复
  - 两边都改过：提示你选择保留哪一份
- 上传时，如果云端在你上次同步之后被其他设备改过，会提示冲突，不会直接覆盖
- 侧边栏底部（手机端为右上角的云朵图标）显示同步状态；有未同步的修改时，点击即可上传
- 「设置 → 本地备份」可以导出 / 导入 JSON

## 从旧版本（v1.x）升级

- **必须设置 `APP_PASSWORD`**，否则 AI 分析和云同步都无法使用
- 构建产物改为 `dist/client`（静态资源）+ `dist/ai_note`（Worker），请按上文更新部署命令
- 旧的 `/api/config` 和 `/api/mimo` 接口已删除。旧版 `/api/config` 会把 `GITEE_TOKEN` 返回给任何访问者，**建议在 Gitee 中重新生成一个 Token**
- 浏览器中保存的明文 API Key 和 Gitee Token 会在首次打开新版本时自动清除
- 本地开发不再在设置页填写 API Key，改为写入 `.dev.vars`
- 默认模型改为 `mimo-v2.6-flash`。MiMo 已不再支持 `mimo-v2-flash`，如果 `MIMO_MODEL_NAME` 还是这个值，请改成 `mimo-v2.6-flash` 或删除该变量
- 现有的本地笔记和 Gist 数据无需迁移
- 浏览器要求：Chrome 111+ / Safari 16.4+ / Firefox 128+（Tailwind CSS 4 的要求）

## 项目结构

```
src/
  App.tsx            页面组装
  components/        界面组件（卡片、弹窗、侧边栏……）
  hooks/             鉴权、同步、筛选、快捷键
  state/             笔记 store（localStorage 持久化）
  lib/               纯逻辑：搜索排序、同步决策、备份
  api/client.ts      /api 请求封装
worker/              Cloudflare Worker：鉴权、MiMo、Gitee
shared/              前后端共用的类型与数据整理
```
