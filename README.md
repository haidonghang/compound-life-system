# 复利人生系统

一个低成本个人成长任务管理 H5/PWA 原型，使用 Vue3 + Vite 实现。第一版数据保存在浏览器 `localStorage`，后续可以把 `src/store/useAppStore.js` 中的数据读写替换为 Supabase 表操作。

## 功能页面

- 首页：当前日期时间、今日完成率、今日三件大事、今日复利分、十年目标倒计时
- 目标页：10 年、3 年、1 年、月目标管理
- 任务页：新增、编辑、删除任务，支持优先级、预计时间、截止时间、所属目标、状态
- 执行页：开始、暂停、完成任务，记录实际用时、完成质量、卡点、证据说明
- 事件页：记录正面、负面、机会、风险事件
- 复盘页：每日复盘表单
- 数据页：最近 7 天完成率、类别任务数量、连续执行天数、拖延任务

## 运行方式

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
npm run preview
```

## 如何部署到公网

当前版本适合先用免费静态托管部署，优先推荐 Vercel，也可以用 Netlify。两者默认都会提供 HTTPS 域名，例如 `https://xxx.vercel.app` 或 `https://xxx.netlify.app`，手机可以直接打开。

### 1. 本地构建项目

在项目根目录执行：

```bash
npm install
npm run build
```

构建成功后会生成 `dist` 文件夹。`dist` 就是可以部署到公网的静态网站文件。

### 2. 用 Netlify 拖拽 `dist` 部署

1. 打开 [Netlify](https://app.netlify.com/) 并登录。
2. 进入 `Sites` 页面，选择 `Add new site`。
3. 选择手动部署入口，把本地生成的 `dist` 文件夹拖进去。
4. 等待上传完成，Netlify 会生成一个 `https://xxx.netlify.app` 域名。
5. 用手机打开这个 HTTPS 地址即可访问。

项目已包含 `netlify.toml`。如果后续改为连接 GitHub 自动部署，Netlify 会使用：

- Build command：`npm run build`
- Publish directory：`dist`

### 3. 用 Vercel 连接 GitHub 部署

1. 把本项目提交到 GitHub 仓库。
2. 打开 [Vercel](https://vercel.com/) 并登录。
3. 点击 `Add New...`，选择 `Project`。
4. 选择你的 GitHub 仓库并导入。
5. Framework Preset 选择 `Vite`。
6. Build Command 保持 `npm run build`。
7. Output Directory 保持 `dist`。
8. 点击 `Deploy`，完成后会得到 `https://xxx.vercel.app` 域名。

项目已包含 `vercel.json`，Vercel 会按该配置执行安装、构建和静态输出。

### 4. 手机添加到主屏幕

部署到 Vercel 或 Netlify 后，必须使用 HTTPS 地址打开。PWA 文件位于 `public/manifest.webmanifest` 和 `public/sw.js`，构建后会进入 `dist` 根目录。

- Android Chrome：打开网站后，点击浏览器菜单，选择“添加到主屏幕”或“安装应用”。
- iPhone Safari：打开网站后，点击分享按钮，选择“添加到主屏幕”。

如果刚部署后没有出现安装入口，先刷新页面一次，或关闭浏览器重新打开 HTTPS 地址。Service Worker 通常需要首次加载后才会完成注册。

### 5. 当前数据同步限制

第一版数据只保存在当前浏览器的 `localStorage`。这意味着：

- 同一台手机、同一个浏览器里数据会保留。
- 换手机、换浏览器、清理浏览器数据后，不会自动同步。
- 当前版本没有登录系统，也没有接 Supabase，成本可以保持在免费方案内。

## 数据结构

核心数据保存在 `localStorage` 的 `compound-life-system-state` 键下：

```js
{
  version: 1,
  settings: {
    appStartedAt: '2026-06-25T00:00:00.000Z'
  },
  goals: [
    {
      id: 'goal_xxx',
      level: '10y',
      name: '目标名称',
      category: '学习',
      deadline: '2036-06-25',
      reason: '重要原因',
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z'
    }
  ],
  tasks: [
    {
      id: 'task_xxx',
      title: '任务名',
      category: '学习',
      priority: 'S',
      estimatedMinutes: 90,
      dueAt: '2026-06-25T21:00',
      goalId: 'goal_xxx',
      status: 'todo',
      actualSeconds: 0,
      quality: 0,
      blockers: '',
      evidence: '',
      sessions: [],
      completedAt: null,
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z'
    }
  ],
  events: [
    {
      id: 'event_xxx',
      date: '2026-06-25',
      type: 'positive',
      title: '事件标题',
      description: '事件说明',
      createdAt: '2026-06-25T00:00:00.000Z'
    }
  ],
  reviews: [
    {
      id: 'review_xxx',
      date: '2026-06-25',
      done: '',
      problems: '',
      shortcomings: '',
      reasons: '',
      improvements: '',
      gains: '',
      tomorrowFocus: '',
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z'
    }
  ]
}
```

## 后续接 Supabase 的建议

- `goals`、`tasks`、`events`、`reviews` 分别建表，字段沿用当前结构。
- 先保留 `id` 为客户端生成，或迁移为 Supabase `uuid`。
- 在 `useAppStore.js` 中把 `loadState()`、`persist()` 和各 action 替换为 Supabase CRUD。
- 增加 `user_id` 字段后即可支持多用户。
