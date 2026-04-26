# NCT_frontend

<div align="center">
  <p><strong>NCT_frontend</strong></p>
  <p>NO CONVERSION THERAPY frontend</p>
  <p>用于记录、整理与公开展示“扭转治疗”相关机构与经历信息的多语言站点前端。</p>
  <p>
    <a href="./README.md"><strong>简体中文</strong></a> ·
    <a href="./README.zh-TW.md">繁體中文</a> ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white">
    <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
    <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
    <img alt="Static Content Snapshots" src="https://img.shields.io/badge/Static-Content%20Snapshots-0F766E">
  </p>
</div>

> 更新说明（2026-04-25）：当前 `NCT_frontend` 项目根目录已经是独立的 `Vite + React` 静态前端项目。旧版 `Express + EJS + Workers` 已迁到同级 `../NCT_old`；公开 JSON、表单、翻译、数据写入等后端能力请配合同级 `../NCT_database` 与 `../NCT_backend` 使用。

## 项目定位

`NCT_frontend` 现在负责的是“前端展示壳层”，不是后端服务：

- 渲染 `/`、`/map`、`/blog`、`/port/:id`、`/privacy`、`/form` 等静态前端路由
- 在构建阶段生成 `site-bootstrap.json`、`area-selector.json` 和博客文章快照
- 复用仓库内的 `public/content/map-data.json` 静态快照，并在运行时按需读取公开地图数据
- 在配置 `VITE_NCT_SUB_FORM_URL` 时，把 `/form` 入口跳转到 `NCT_backend` 的独立表单页
- 在配置 `VITE_NCT_SUB_FORM_URL` 时，复用同一后端的 `/api/no-torsion/translate-text` 处理英文博客正文，以及非 `zh-CN` 语言下记录详情的运行时翻译

当前根目录 **不再** 提供下列能力：

- `Express + EJS` 页面服务
- Cloudflare Worker 后端
- 表单提交写入 API
- 机构修正提交 API
- `/api/frontend-runtime` 这类运行时 token 接口

如果你仍然需要上述能力，请使用：

- [`../NCT_old`](../NCT_old)：旧版 `Express + EJS + Workers`
- [`../NCT_database`](../NCT_database)：母库、公开 JSON、管理台、推送与灾备回拉
- [`../NCT_backend`](../NCT_backend)：独立表单页、`NCT_frontend` 后端 API、翻译与上报

## 当前功能

| 模块 | 说明 |
| --- | --- |
| 首页 / 门户 | 单页前端壳层，负责导航、语言切换与页面路由 |
| 地图浏览 | 读取 `VITE_NCT_API_SQL_PUBLIC_DATA_URL` 指向的公开 JSON；默认回退到仓库内 `public/content/map-data.json` |
| 博客内容 | 构建时把 Markdown 转成包含预渲染 HTML 的静态 JSON，前端按需加载 |
| 多语言 | 通过 `site-bootstrap.json` 下发词条、语言选项和默认语言 |
| 表单入口 | `/form` 始终是前端入口页；配置 `VITE_NCT_SUB_FORM_URL` 后会自动跳转到 `NCT_backend` 的独立表单页，否则显示 `api-only` 说明 |
| 运行时翻译 | 需配置 `VITE_NCT_SUB_FORM_URL`；英文博客启用文章翻译，非 `zh-CN` 记录详情启用字段翻译 |

## 兼容说明

仓库里仍保留了部分迁移期前端逻辑，方便与旧链路兼容，但要注意：

- `/form` 在当前项目里不是本地提交流程，而是一个跳转 / 说明页
- 仓库仍保留了机构修正、提交预览 / 确认 / 结果页等兼容组件
- 这些兼容页面通常依赖后端以非 `frontend-router` 的 `pageType` / `pageProps` 注入方式复用；纯静态部署不会自行解析 `/map/correction` 之类路径
- 相关提交仍依赖同源的 `/api/frontend-runtime`、`/map/correction/submit` 或 `/correction/submit`
- 这些接口 **并不在当前项目中实现**

也就是说，直接把 `NCT_frontend` 当作“纯静态站点”部署时：

- 地图、博客、隐私页、文章详情页，以及 `/form` 的说明 / 跳转页可以正常工作
- `/form` 只有在配置 `VITE_NCT_SUB_FORM_URL` 后才会自动跳转，并出现在主导航中
- 机构修正与旧提交流程需要额外提供兼容后端，或者继续使用 `NCT_old`

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 前端框架 | Vite 8 + React 19 |
| 地图展示 | Leaflet |
| 内容构建 | Node.js 脚本生成静态 JSON 快照 |
| 内容来源 | `blog/*.md`、`data.json`、`friends.json`、公开地图 JSON |
| 部署形态 | 静态站点 |

## 仓库结构

```text
.
├── frontend/src/              # React 前端入口、路由与页面逻辑
├── public/content/            # 构建期快照与受版本控制的 map-data.json
├── blog/                      # Markdown 博客源文件
├── config/                    # i18n、地区选项、运行时配置
├── scripts/                   # 构建期内容生成与配置工具
├── tests/                     # 前端 / 构建脚本测试
├── vite.config.js             # Vite 配置
└── index.html                 # SPA 宿主页
```

## 环境变量

复制环境文件：

```bash
cp .env.example .env
```

[`./.env.example`](./.env.example) 已按修改必要性排序列出当前项目会读取的全部项目级环境变量，以及通常由平台注入的运行时标记。

### 必填环境变量

当前项目没有绝对必填环境变量；把它当作纯静态站点时，零配置也能启动。

按功能视为必填：

- `VITE_NCT_API_SQL_PUBLIC_DATA_URL`：当你希望前端直接读取 `NCT_database` 的实时公开数据，而不是仓库内快照时
- `VITE_NCT_SUB_FORM_URL`：当你希望启用 `/form` 跳转和运行时翻译时

关键变量如下：

| 变量 | 说明 |
| --- | --- |
| `VITE_NCT_API_SQL_PUBLIC_DATA_URL` | 公开地图 JSON 地址；默认 `/content/map-data.json` |
| `VITE_NCT_SUB_FORM_URL` | `NCT_backend` 的独立表单页地址，例如 `https://sub.example.com/form` |

补充说明：

- `VITE_*` 变量会暴露到浏览器运行时
- 是否配置 `VITE_NCT_SUB_FORM_URL` 会决定前端部署模式：有值视为 `hono`，空值视为 `api-only`
- 构建时地图快照固定使用仓库内的 `public/content/map-data.json`，不再通过环境变量刷新远端快照
- `RUNTIME_TARGET` / `CF_PAGES` 通常由运行平台注入，本地一般不需要手动设置
- [`.dev.vars.example`](./.dev.vars.example) 现在只用于说明根目录不再部署 Worker 后端

## 快速开始

```bash
cd <project-root>
npm install
cp .env.example .env
npm run dev
```

默认开发地址：

- Vite 开发服务器：`http://127.0.0.1:5173`

如果希望接入完整链路，通常还需要同时启动：

- `../NCT_database`：提供公开地图 JSON
- `../NCT_backend`：提供独立表单页和翻译 API

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run frontend:prepare-content` | 生成 `public/content/*` 静态快照 |
| `npm run frontend:build` | 先生成内容快照，再执行前端构建 |
| `npm run frontend:preview` | 本地预览构建产物 |
| `npm run test:unit` | 运行 Node 单元测试 |
| `npm test` | 运行测试并执行一次构建检查 |

说明：

- `npm run dev:workers` 和 `npm run deploy:workers` 只用于 Workers Static Assets 静态前端，不会启动或部署后端 API

## 构建期静态内容

`npm run frontend:prepare-content` 会写入 / 更新这些文件：

- `public/content/site-bootstrap.json`
- `public/content/area-selector.json`
- `public/content/blog/index.json`
- `public/content/blog/articles/*.json`
- `public/content/map-data.json`（不会由脚本重新生成；脚本只会校验并复用仓库内已有快照，缺失时构建失败）

这让前端在“无自带后端”的前提下，仍然可以直接展示：

- 地图数据
- 多语言词条
- 博客列表与文章正文

## Cloudflare Workers 部署

仅推荐使用 Cloudflare Dashboard 的 Workers Builds 网页部署。本项目是 Workers Static Assets 静态前端，项目名使用目录名的 Workers 兼容形式：`nct-frontend`。

网页部署会读取 [`wrangler.toml`](./wrangler.toml)。本项目不需要 D1、R2、Cron 或 Worker Secret；`[assets].directory = "./dist"` 会发布 Vite 构建产物，`not_found_handling = "single-page-application"` 会让 `/map`、`/blog`、`/form` 等前端路由回退到 `index.html`。

### Workers Builds 填写

| Cloudflare 页面字段 | 填写值 |
| --- | --- |
| Project name | `nct-frontend` |
| Production branch | 你的生产分支，例如 `main` |
| Path / Root directory | 在本仓库部署填 `NCT_frontend`；如果本项目单独成库填 `/` |
| Build command | `npm run test:unit` |
| Deploy command | `npm run deploy:workers` |
| Non-production branch deploy command | `npm run deploy:workers:preview` |

### 网页端步骤

1. 进入 Cloudflare Dashboard -> `Workers & Pages` -> `Create` -> `Import a repository`。
2. 选择 Git 仓库后，按上表填写 `Project name`、`Path`、`Build command`、`Deploy command` 和 `Non-production branch deploy command`。
3. 在 `Settings` -> `Variables and Secrets` 添加构建期变量：
   - `VITE_NCT_API_SQL_PUBLIC_DATA_URL=https://api.example.com/`
   - `VITE_NCT_SUB_FORM_URL=https://sub.example.com/form`
4. 在 `Settings` -> `Domains & Routes` -> `Add` -> `Custom Domain` 绑定 `www.example.com`。
5. 推送生产分支触发部署。`Deploy command` 会生成静态内容快照、执行 Vite build，并发布 Workers Static Assets。

注意：`VITE_*` 是构建期变量，在 Dashboard 修改后需要重新部署才会写入前端产物。表单和数据写入能力来自同级部署的 `NCT_backend` 与 `NCT_database`。

部署后检查：

```text
https://www.example.com/
https://www.example.com/map
https://www.example.com/blog
https://www.example.com/form
```

`/form` 应跳转到 `https://sub.example.com/form`。地图页应从 `https://api.example.com/` 读取公开 JSON；如果读不到，会回退到构建产物中的静态快照。

## README 核对结果

本次核对后确认：

- `NCT_frontend` 的实际职责是“静态前端壳层”，不是旧版全栈服务
- `frontend:prepare-content` 不会抓取或重新生成 `map-data.json`，只会复用并校验仓库内快照
- 机构修正等兼容页面仍在代码里，但纯静态 `frontend-router` 部署不会直接暴露这些路由
