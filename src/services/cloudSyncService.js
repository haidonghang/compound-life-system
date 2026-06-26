import { getSupabaseConfig, isSupabaseConfigured, supabaseFetch } from './supabaseClient';

const SESSION_KEY = 'compound-life-system-supabase-session';
const AUTH_LISTENERS = new Set();

export const SYNC_STATUS = {
  local: {
    key: 'local',
    label: '本地模式',
    message: '本地模式：当前数据只保存在本设备',
  },
  authenticated: {
    key: 'authenticated',
    label: '已登录',
    message: '已登录：请选择上传本地数据或从云端拉取',
  },
  syncing: {
    key: 'syncing',
    label: '同步中',
    message: '正在同步数据',
  },
  synced: {
    key: 'synced',
    label: '已同步',
    message: '数据已保存到云端',
  },
  failed: {
    key: 'failed',
    label: '同步失败',
    message: '同步失败：请检查网络或 Supabase 配置',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function getStoredSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session?.access_token) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
  AUTH_LISTENERS.forEach((listener) => listener(getSessionUser(session)));
}

function getAccessToken() {
  return getStoredSession()?.access_token || '';
}

function getSessionUser(session = getStoredSession()) {
  return session?.user || null;
}

export function getCloudAccessToken() {
  return getAccessToken();
}

export function getCloudUser() {
  return getSessionUser();
}

function authHeaders() {
  const token = getAccessToken();
  if (!token) throw new Error('请先登录 Supabase 账号。');
  return { Authorization: `Bearer ${token}` };
}

function userId() {
  const id = getSessionUser()?.id;
  if (!id) throw new Error('请先登录 Supabase 账号。');
  return id;
}

function toDate(value) {
  return value ? String(value).slice(0, 10) : null;
}

function emptyToNull(value) {
  return value || null;
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function goalToRow(goal) {
  return {
    id: goal.id,
    user_id: userId(),
    level: goal.level,
    title: goal.title,
    description: goal.description || '',
    category: goal.category || '其他',
    deadline: toDate(goal.deadline),
    parent_goal_id: emptyToNull(goal.parentGoalId),
    created_at: goal.createdAt || nowIso(),
    updated_at: goal.updatedAt || nowIso(),
  };
}

function rowToGoal(row) {
  return {
    id: row.id,
    level: row.level || 'one_year',
    title: row.title || '未命名目标',
    description: row.description || '',
    category: row.category || '其他',
    deadline: row.deadline || '',
    parentGoalId: row.parent_goal_id || '',
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

function taskToRow(task) {
  return {
    id: task.id,
    user_id: userId(),
    title: task.title,
    category: task.category || '其他',
    goal_id: emptyToNull(task.goalId),
    priority: task.priority || 'B',
    score: Number(task.score || 0),
    estimated_minutes: Number(task.estimatedMinutes || 30),
    actual_minutes: Number(task.actualMinutes || 0),
    progress: Number(task.progress || 0),
    quality_score: Number(task.qualityScore || 80),
    status: task.status || 'pending',
    task_date: toDate(task.date),
    deadline: emptyToNull(task.deadline),
    evidence_required: Boolean(task.requiresEvidence),
    evidence_items: task.evidenceItems || [],
    sessions: task.sessions || [],
    reason: task.reason || '',
    blockers: task.blockers || '',
    completed_at: emptyToNull(task.completedAt),
    created_at: task.createdAt || nowIso(),
    updated_at: task.updatedAt || nowIso(),
  };
}

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title || '未命名任务',
    category: row.category || '其他',
    goalId: row.goal_id || '',
    priority: row.priority || 'B',
    score: Number(row.score || 0),
    estimatedMinutes: Number(row.estimated_minutes || 30),
    actualMinutes: Number(row.actual_minutes || 0),
    progress: Number(row.progress || 0),
    qualityScore: Number(row.quality_score || 80),
    status: row.status || 'pending',
    date: row.task_date || toDate(row.created_at) || '',
    deadline: row.deadline || '',
    requiresEvidence: Boolean(row.evidence_required),
    evidenceItems: Array.isArray(row.evidence_items) ? row.evidence_items : [],
    sessions: Array.isArray(row.sessions) ? row.sessions : [],
    reason: row.reason || '',
    blockers: row.blockers || '',
    completedAt: row.completed_at || null,
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

function rowToEvidenceItem(row) {
  return {
    id: row.id,
    type: row.type || 'file',
    title: row.title || row.file_name || '文件交付物',
    content: row.content || '',
    url: row.url || '',
    storagePath: row.storage_path || '',
    fileName: row.file_name || '',
    fileType: row.file_type || '',
    fileSize: Number(row.file_size || 0),
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

function reviewToRow(review) {
  return {
    id: review.id,
    user_id: userId(),
    review_date: toDate(review.date),
    main_deviation: review.offMainLine || 'no',
    biggest_gain: review.biggestGain || '',
    tomorrow_improvement: review.tomorrowChange || '',
    notes: review.notes || '',
    created_at: review.createdAt || nowIso(),
    updated_at: review.updatedAt || nowIso(),
  };
}

function rowToReview(row) {
  return {
    id: row.id,
    date: row.review_date || toDate(row.created_at) || '',
    offMainLine: row.main_deviation || 'no',
    biggestGain: row.biggest_gain || '',
    tomorrowChange: row.tomorrow_improvement || '',
    notes: row.notes || '',
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

function eventToRow(event) {
  return {
    id: event.id,
    user_id: userId(),
    event_date: toDate(event.date),
    type: event.type || 'positive',
    title: event.title || '未命名事件',
    description: event.description || '',
    created_at: event.createdAt || nowIso(),
    updated_at: event.updatedAt || nowIso(),
  };
}

function rowToEvent(row) {
  return {
    id: row.id,
    date: row.event_date || toDate(row.created_at) || '',
    type: row.type || 'positive',
    title: row.title || '未命名事件',
    description: row.description || '',
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

async function rest(path, options = {}) {
  return supabaseFetch(`/rest/v1${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
}

async function upsert(table, row) {
  const rows = await rest(`/${table}?on_conflict=id`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(row),
  });
  return rows?.[0] || row;
}

async function removeById(table, id) {
  await rest(`/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}

export function getLocalSyncStatus() {
  return getSessionUser() ? SYNC_STATUS.authenticated : SYNC_STATUS.local;
}

export function subscribeAuthState(listener) {
  AUTH_LISTENERS.add(listener);
  return () => AUTH_LISTENERS.delete(listener);
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const session = getStoredSession();
  if (!session?.access_token) return null;

  try {
    const user = await supabaseFetch('/auth/v1/user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    saveSession({ ...session, user });
    return user;
  } catch {
    saveSession(null);
    return null;
  }
}

export async function signUp(email, password) {
  const data = await supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data?.access_token) saveSession(data);
  return data;
}

export async function signIn(email, password) {
  const data = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveSession(data);
  return data.user;
}

export async function signOut() {
  const token = getAccessToken();
  if (token && isSupabaseConfigured()) {
    try {
      await supabaseFetch('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Local sign-out should still work when network is unavailable.
    }
  }
  saveSession(null);
}

export async function fetchCloudData() {
  const [goals, tasks, reviews, events, settingsRows, evidenceRows] = await Promise.all([
    rest('/goals?select=*&order=updated_at.desc'),
    rest('/tasks?select=*&order=updated_at.desc'),
    rest('/reviews?select=*&order=review_date.desc'),
    rest('/events?select=*&order=event_date.desc'),
    rest('/settings?select=*'),
    rest('/evidence_items?select=*&order=created_at.asc').catch(() => []),
  ]);
  const evidenceByTask = normalizeRows(evidenceRows).reduce((acc, row) => {
    const item = rowToEvidenceItem(row);
    if (!acc[row.task_id]) acc[row.task_id] = [];
    acc[row.task_id].push(item);
    return acc;
  }, {});
  const cloudTasks = normalizeRows(tasks).map((row) => {
    const task = rowToTask(row);
    const tableItems = evidenceByTask[task.id] || [];
    const existingIds = new Set(tableItems.map((item) => item.id));
    task.evidenceItems = [...tableItems, ...(task.evidenceItems || []).filter((item) => !existingIds.has(item.id))];
    return task;
  });

  return {
    version: '3.1.4',
    goals: normalizeRows(goals).map(rowToGoal),
    tasks: cloudTasks,
    reviews: normalizeRows(reviews).map(rowToReview),
    events: normalizeRows(events).map(rowToEvent),
    settings: normalizeRows(settingsRows)[0]?.data || {},
  };
}

export async function saveGoalToCloud(goal) {
  return rowToGoal(await upsert('goals', goalToRow(goal)));
}

export async function saveTaskToCloud(task) {
  return rowToTask(await upsert('tasks', taskToRow(task)));
}

export async function saveReviewToCloud(review) {
  return rowToReview(await upsert('reviews', reviewToRow(review)));
}

export async function saveEventToCloud(event) {
  return rowToEvent(await upsert('events', eventToRow(event)));
}

export async function saveSettingsToCloud(settings) {
  const rows = await rest('/settings?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify({
      user_id: userId(),
      data: settings || {},
      updated_at: nowIso(),
    }),
  });
  return rows?.[0]?.data || settings;
}

export async function deleteGoalFromCloud(id) {
  return removeById('goals', id);
}

export async function deleteTaskFromCloud(id) {
  return removeById('tasks', id);
}

export async function deleteReviewFromCloud(id) {
  return removeById('reviews', id);
}

export async function deleteEventFromCloud(id) {
  return removeById('events', id);
}

export async function uploadLocalDataToCloud(localData) {
  await Promise.all([
    ...(localData.goals || []).map(saveGoalToCloud),
    ...(localData.tasks || []).map(saveTaskToCloud),
    ...(localData.reviews || []).map(saveReviewToCloud),
    ...(localData.events || []).map(saveEventToCloud),
    saveSettingsToCloud(localData.settings || {}),
  ]);
  return fetchCloudData();
}

export async function downloadCloudDataToLocal() {
  return fetchCloudData();
}

export function getCloudSyncInfo() {
  return {
    ...getSupabaseConfig(),
    user: getSessionUser(),
  };
}
