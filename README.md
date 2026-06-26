# 复利人生系统

Vue3 + Vite + PWA 个人目标执行系统。V3.1.4 接入 Supabase Storage 文件交付物：未登录继续支持文字/链接交付物，登录后可上传截图、PDF、录音、代码文件等真实文件。

## V3.1.4 文件交付物

- 新增 Supabase Storage 上传，bucket 名称：`evidence-files`。
- bucket 建议设置为 private。
- 文件路径规则：`user_id/task_id/evidence_id/filename`。
- 新增 `evidence_items` 元数据表，记录文件名、文件类型、大小和 Storage 路径。
- 未登录时不能上传文件，但仍可添加文字交付物和链接交付物。
- 删除文件交付物时，会同时删除 Storage 文件和 `evidence_items` 记录。
- 前端仍然只使用 anon public key，不使用 `service_role` key。

## V3.1.3 云同步

- 新增 Supabase Auth 邮箱注册、登录、退出。
- 新增同步/账号面板：显示本地模式、已登录、同步中、已同步、同步失败。
- 未登录时继续使用 localStorage，不破坏原本本地模式。
- 登录后新增、编辑、删除目标和任务会尝试同步到云端。
- 首次登录后不会自动覆盖数据，必须手动点击“上传本地数据到云端”或“从云端拉取数据”。
- JSON 导出/导入继续保留，作为离线备份兜底。
- 前端只使用 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，不要使用 `service_role` key。

## 三个入口

- 今日台：今日三件大事、当前执行倒计时、任务新增、任务基础编辑、进度质量和交付物记录。
- 目标台：目标阶梯、自定义分类。
- 复盘台：三道点选复盘、月视图、当天任务、伪努力提醒、JSON 备份。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

不要把 Supabase `service_role` key 写进前端，也不要提交到 GitHub。

## Supabase 创建步骤

1. 在 Supabase 创建项目。
2. 在 Project Settings → API 复制 Project URL 和 anon public key。
3. 在本地 `.env` 写入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
4. 在 SQL Editor 执行下面的建表 SQL 和 RLS 策略。
5. 运行 `npm run dev`，在页面顶部同步面板注册或登录。

## 数据表 SQL

```sql
create table if not exists goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text,
  title text,
  description text,
  category text,
  deadline date,
  parent_goal_id uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  category text,
  goal_id uuid null,
  priority text,
  score integer,
  estimated_minutes integer,
  actual_minutes integer,
  progress integer,
  quality_score integer,
  status text,
  task_date date,
  deadline timestamptz null,
  evidence_required boolean default false,
  evidence_items jsonb default '[]'::jsonb,
  sessions jsonb default '[]'::jsonb,
  reason text,
  blockers text,
  completed_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date,
  main_deviation text,
  biggest_gain text,
  tomorrow_improvement text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date,
  type text,
  title text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists evidence_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  type text,
  title text,
  content text,
  url text null,
  storage_path text null,
  file_name text null,
  file_type text null,
  file_size integer null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
```

## RLS 策略

```sql
alter table goals enable row level security;
alter table tasks enable row level security;
alter table reviews enable row level security;
alter table events enable row level security;
alter table evidence_items enable row level security;
alter table settings enable row level security;

create policy "goals_select_own" on goals for select using (auth.uid() = user_id);
create policy "goals_insert_own" on goals for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on goals for delete using (auth.uid() = user_id);

create policy "tasks_select_own" on tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on tasks for delete using (auth.uid() = user_id);

create policy "reviews_select_own" on reviews for select using (auth.uid() = user_id);
create policy "reviews_insert_own" on reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews_delete_own" on reviews for delete using (auth.uid() = user_id);

create policy "events_select_own" on events for select using (auth.uid() = user_id);
create policy "events_insert_own" on events for insert with check (auth.uid() = user_id);
create policy "events_update_own" on events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events_delete_own" on events for delete using (auth.uid() = user_id);

create policy "evidence_items_select_own" on evidence_items for select using (auth.uid() = user_id);
create policy "evidence_items_insert_own" on evidence_items for insert with check (auth.uid() = user_id);
create policy "evidence_items_update_own" on evidence_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "evidence_items_delete_own" on evidence_items for delete using (auth.uid() = user_id);

create policy "settings_select_own" on settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on settings for delete using (auth.uid() = user_id);
```

## Supabase Storage

创建 private bucket：

```sql
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence-files', 'evidence-files', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760;
```

Storage RLS policy：

```sql
create policy "evidence_files_select_own"
on storage.objects for select
using (
  bucket_id = 'evidence-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "evidence_files_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'evidence-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "evidence_files_update_own"
on storage.objects for update
using (
  bucket_id = 'evidence-files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'evidence-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "evidence_files_delete_own"
on storage.objects for delete
using (
  bucket_id = 'evidence-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

上传限制：

- 单个文件不超过 10MB。
- 支持图片、PDF、音频、代码文本、压缩包。
- 如果文件过大，请压缩后上传，或改为填写链接交付物。

## 同步规则

1. 未登录：所有数据写入 localStorage。
2. 登录：顶部同步面板显示当前账号，不自动覆盖任何数据。
3. 上传本地数据到云端：把当前设备数据保存到 Supabase，同 id 数据会更新。
4. 从云端拉取数据：用云端数据覆盖当前本地数据，操作前会弹窗确认。
5. 同步失败时，本地数据仍保留，可继续导出 JSON 备份。

## JSON 备份

导出内容包括：

- goals
- tasks
- events
- reviews
- settings

导入前会做格式校验，并弹窗确认是否覆盖当前本地数据。

## Vercel 部署

1. 提交代码到 GitHub。
2. 在 Vercel 导入仓库。
3. Framework Preset 选择 `Vite`。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。
6. 在 Project Settings → Environment Variables 增加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. 点击 Deploy。

项目已包含 `vercel.json`，Vercel 会按 Vite 静态站点部署。
