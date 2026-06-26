import { computed, reactive, watch } from 'vue';
import { addDays, daysBetween, sameDay, todayKey } from '../utils/date';
import {
  calculateDailyCompoundScore,
  calculateTaskScore,
  defaultCategories,
  detectFakeEffort,
  evidenceTypeLabel,
  evidenceTypes,
  goalLevels,
  hasEvidence,
  lowScoreWarning,
  priorities,
  priorityFromScore,
  shouldRequireEvidence,
  taskStatuses,
} from '../utils/scoring';
import { createExportPayload, downloadJson, loadState, validateImportPayload, saveState } from '../services/storageService';
import {
  SYNC_STATUS,
  deleteEventFromCloud,
  deleteGoalFromCloud,
  deleteTaskFromCloud,
  downloadCloudDataToLocal as downloadCloudData,
  getCloudSyncInfo,
  getCurrentUser,
  saveEventToCloud,
  saveGoalToCloud,
  saveReviewToCloud,
  saveSettingsToCloud,
  saveTaskToCloud,
  signIn as cloudSignIn,
  signOut as cloudSignOut,
  signUp as cloudSignUp,
  subscribeAuthState,
  uploadLocalDataToCloud as uploadCloudData,
} from '../services/cloudSyncService';

const eventTypes = [
  { value: 'positive', label: '正面事件' },
  { value: 'negative', label: '负面事件' },
  { value: 'opportunity', label: '机会事件' },
  { value: 'risk', label: '风险事件' },
];

const levelAliases = {
  '10y': 'ten_year',
  '5y': 'five_year',
  '3y': 'three_year',
  '1y': 'one_year',
  ten_year: 'ten_year',
  five_year: 'five_year',
  three_year: 'three_year',
  one_year: 'one_year',
  month: 'month',
  week: 'week',
  day: 'day',
};

const categoryAliases = {
  学习: '学习成长',
  职业: '实习职业',
  健康: '身体财富',
  财务: '身体财富',
  财富: '身体财富',
  表达: '表达能力',
  项目: '项目作品',
  生活: '其他',
};

const evidenceTypeAliases = {
  笔记: 'note',
  截图: 'screenshot',
  截图说明: 'screenshot',
  代码: 'code',
  图纸: 'drawing',
  录音: 'audio',
  录音说明: 'audio',
  投递记录: 'delivery_record',
  复盘文字: 'review_text',
  链接: 'link',
  文件: 'file',
  其他: 'other',
};

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function uid(prefix) {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCategory(value) {
  const raw = String(value || '').trim();
  if (!raw) return '其他';
  if (categoryAliases[raw]) return categoryAliases[raw];
  if (raw.includes('考研') || raw.includes('学历')) return '学习成长';
  if (raw.includes('实习') || raw.includes('职业')) return '实习职业';
  if (raw.includes('身体') || raw.includes('健康') || raw.includes('财富')) return '身体财富';
  return raw;
}

function normalizeLegacyGoalTitle(title) {
  if (title === '成为企业家，十年冲刺上亿资产') return '长期人生目标';
  if (title?.includes('行业佼佼者')) return '三年职业成长目标';
  if (title?.includes('还清5万元贷款')) return '今年最重要目标';
  return title;
}

function normalizeLegacyTaskTitle(title) {
  if (/^探索.+：整理岗位要求并提炼3个能力关键词$/.test(title)) return '写下一个职业观察结论';
  return (
    {
      '背考研英语单词30个并截图': '整理今天学到的3个关键点',
      '完成数学基础题10道并记录错题': '完成一组学习练习并记录错因',
      '精读一篇英语长难句并写出句子主干': '完成一组学习练习并记录错因',
      '复盘一道错题并写出错误原因': '整理今天学到的3个关键点',
      '记录今天实习中看到的一个设备/流程': '记录一个工作或学习中的问题',
      '写3条今天在实习中学到的东西': '整理今天学到的3个关键点',
      '把一个工作内容转化为简历项目语言': '把今天的经历写成一条简历素材',
      '记录一个现场问题，并写出可能原因': '记录一个工作或学习中的问题',
      '完成定时器T0的3道练习题': '推进一个项目作品的最小交付物',
      '画一张三相电机正反转控制图': '推进一个项目作品的最小交付物',
      '整理5个低压电气元件的作用和接线方式': '整理今天学到的3个关键点',
      '完成一个PLC自锁互锁小程序': '推进一个项目作品的最小交付物',
      '画一个PLC输入输出I/O表': '推进一个项目作品的最小交付物',
      '给毕设画系统框图': '推进一个项目作品的最小交付物',
      '写一个功能模块说明': '补充一个作品说明或截图说明',
      '生成一张I/O表': '推进一个项目作品的最小交付物',
      '上传程序截图或图纸截图': '补充一个作品说明或截图说明',
      '复述一个电气知识点': '录制2分钟自我表达练习',
      '力量训练40分钟': '散步或训练20分钟并记录状态',
      '低能量状态下散步20分钟并提前睡觉': '散步或训练20分钟并记录状态',
      '记录今日消费': '记录今日消费和还款进度',
      '更新5万元贷款还款进度': '记录今日消费和还款进度',
    }[title] || title
  );
}

function createDefaultState() {
  const now = nowIso();
  return {
    version: '3.1.4',
    settings: {
      appStartedAt: now,
      activeDesk: 'today',
      availableTimePreset: 'custom',
      customAvailableMinutes: 120,
      syncStatus: 'local',
      categories: [...defaultCategories],
    },
    goals: [
      {
        id: uid('goal'),
        level: 'ten_year',
        title: '长期人生目标',
        description: '可以改成你的十年愿景。',
        category: '学习成长',
        deadline: '',
        parentGoalId: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid('goal'),
        level: 'one_year',
        title: '今年最重要目标',
        description: '把今年最现实的任务写清楚。',
        category: '实习职业',
        deadline: '',
        parentGoalId: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid('goal'),
        level: 'week',
        title: '本周三件大事',
        description: '每周只保留最关键的推进。',
        category: '身体财富',
        deadline: '',
        parentGoalId: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [],
    events: [],
    reviews: [],
  };
}

function normalizeGoal(goal = {}) {
  const now = nowIso();
  return {
    id: goal.id || uid('goal'),
    level: levelAliases[goal.level] || 'one_year',
    title: normalizeLegacyGoalTitle(String(goal.title || goal.name || '').trim()) || '未命名目标',
    description: goal.description || goal.reason || '',
    category: normalizeCategory(goal.category || goal.mainLine),
    deadline: goal.deadline || '',
    parentGoalId: goal.parentGoalId || '',
    createdAt: goal.createdAt || now,
    updatedAt: goal.updatedAt || now,
  };
}

function normalizeStatus(status) {
  return (
    {
      todo: 'pending',
      doing: 'running',
      done: 'completed',
      pending: 'pending',
      running: 'running',
      paused: 'paused',
      completed: 'completed',
      partially_completed: 'partially_completed',
      abandoned: 'abandoned',
    }[status] || 'pending'
  );
}

function normalizeEvidenceType(type) {
  return evidenceTypeAliases[type] || type || 'note';
}

function normalizeEvidenceItem(item = {}) {
  return {
    id: item.id || uid('evidence'),
    type: normalizeEvidenceType(item.type || item.evidenceType),
    title: String(item.title || evidenceTypeLabel(normalizeEvidenceType(item.type || item.evidenceType))).trim(),
    content: item.content || item.description || item.evidence || '',
    url: item.url || '',
    storagePath: item.storagePath || item.storage_path || '',
    fileName: item.fileName || item.file_name || '',
    fileType: item.fileType || item.file_type || '',
    fileSize: Number(item.fileSize || item.file_size || 0),
    createdAt: item.createdAt || nowIso(),
    updatedAt: item.updatedAt || item.updated_at || item.createdAt || nowIso(),
  };
}

function legacyEvidenceItems(task) {
  if (Array.isArray(task.evidenceItems)) return task.evidenceItems.map(normalizeEvidenceItem);
  if (!String(task.evidence || '').trim()) return [];
  return [
    normalizeEvidenceItem({
      type: normalizeEvidenceType(task.evidenceType),
      title: evidenceTypeLabel(normalizeEvidenceType(task.evidenceType)),
      content: task.evidence,
    }),
  ];
}

function normalizeTask(task = {}, context = {}) {
  const status = normalizeStatus(task.status);
  const completed = status === 'completed' || status === 'partially_completed';
  const deadline = task.deadline || task.dueAt || '';
  const date = task.date || (deadline ? String(deadline).slice(0, 10) : task.completedAt ? String(task.completedAt).slice(0, 10) : todayKey());
  const category = normalizeCategory(task.category || task.mainLine);
  const estimatedMinutes = Math.max(1, Math.round(Number(task.estimatedMinutes || task.estimateMinutes || 30)));
  const actualMinutes =
    task.actualMinutes != null ? Math.max(0, Math.round(Number(task.actualMinutes))) : Math.max(0, Math.round(Number(task.actualSeconds || 0) / 60));
  const qualityScore =
    task.qualityScore != null ? Number(task.qualityScore) : task.quality ? Math.min(100, Number(task.quality) * 20) : completed ? 80 : 70;
  const progress = task.progress != null ? Number(task.progress) : completed ? 100 : 0;
  const evidenceItems = legacyEvidenceItems(task);
  const normalized = {
    id: task.id || uid('task'),
    title: normalizeLegacyTaskTitle(String(task.title || '').trim()) || '未命名任务',
    category,
    goalId: task.goalId || '',
    priority: task.priority || 'B',
    score: Number(task.score || 0),
    estimatedMinutes,
    actualMinutes,
    progress: Math.max(0, Math.min(100, progress)),
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    status,
    date,
    deadline,
    evidenceItems,
    requiresEvidence: typeof task.requiresEvidence === 'boolean' ? task.requiresEvidence : shouldRequireEvidence({ ...task, category }),
    reason: task.reason || '',
    blockers: task.blockers || '',
    sessions: Array.isArray(task.sessions) ? task.sessions : [],
    completedAt: task.completedAt || null,
    createdAt: task.createdAt || nowIso(),
    updatedAt: task.updatedAt || nowIso(),
  };
  normalized.score = Math.max(0, Math.min(100, normalized.score || calculateTaskScore(normalized, context)));
  normalized.priority = task.priority || priorityFromScore(normalized.score);
  normalized.compoundScore = Math.round(normalized.score * (normalized.progress / 100) * (normalized.qualityScore / 100));
  return normalized;
}

function normalizeEvent(event = {}) {
  return {
    id: event.id || uid('event'),
    date: event.date || todayKey(),
    type: event.type || 'positive',
    title: String(event.title || '').trim() || '未命名事件',
    description: event.description || '',
    createdAt: event.createdAt || nowIso(),
  };
}

function normalizeReview(review = {}) {
  const now = nowIso();
  return {
    id: review.id || uid('review'),
    date: review.date || todayKey(),
    offMainLine: review.offMainLine || 'no',
    biggestGain: review.biggestGain || review.gains || '',
    tomorrowChange: review.tomorrowChange || review.tomorrowFocus || review.improvements || '',
    notes: review.notes || review.done || '',
    createdAt: review.createdAt || now,
    updatedAt: review.updatedAt || now,
  };
}

function migrateState(raw) {
  const fallback = createDefaultState();
  const source = raw && typeof raw === 'object' ? raw : fallback;
  const sourceSettings = source.settings || {};
  const settings = {
    ...fallback.settings,
    ...sourceSettings,
    availableTimePreset: 'custom',
    categories: Array.from(new Set([...(sourceSettings.categories || []), ...defaultCategories].map(normalizeCategory))).filter(Boolean),
    syncStatus: 'local',
  };
  const nextState = {
    version: '3.1.4',
    settings,
    goals: Array.isArray(source.goals) ? source.goals.map(normalizeGoal) : [],
    tasks: [],
    events: Array.isArray(source.events) ? source.events.map(normalizeEvent) : [],
    reviews: Array.isArray(source.reviews) ? source.reviews.map(normalizeReview) : [],
  };
  if (!nextState.goals.length) nextState.goals = fallback.goals;
  nextState.tasks = Array.isArray(source.tasks)
    ? source.tasks.map((task) => normalizeTask(task, { energyLevel: settings.todayEnergy }))
    : [];
  ensureUuidState(nextState);
  return nextState;
}

function ensureUuidState(nextState) {
  const goalIdMap = new Map();
  nextState.goals.forEach((goal) => {
    if (!isUuid(goal.id)) {
      const nextId = uid('goal');
      goalIdMap.set(goal.id, nextId);
      goal.id = nextId;
    }
  });
  nextState.goals.forEach((goal) => {
    if (goal.parentGoalId && goalIdMap.has(goal.parentGoalId)) goal.parentGoalId = goalIdMap.get(goal.parentGoalId);
    if (goal.parentGoalId && !isUuid(goal.parentGoalId)) goal.parentGoalId = '';
  });
  nextState.tasks.forEach((task) => {
    if (!isUuid(task.id)) task.id = uid('task');
    if (task.goalId && goalIdMap.has(task.goalId)) task.goalId = goalIdMap.get(task.goalId);
    if (task.goalId && !isUuid(task.goalId)) task.goalId = '';
  });
  nextState.reviews.forEach((review) => {
    if (!isUuid(review.id)) review.id = uid('review');
  });
  nextState.events.forEach((event) => {
    if (!isUuid(event.id)) event.id = uid('event');
  });
}

const state = reactive(migrateState(loadState(createDefaultState)));
const cloudInfo = getCloudSyncInfo();
const syncState = reactive({
  user: cloudInfo.user,
  configured: cloudInfo.configured,
  status: cloudInfo.user ? 'authenticated' : 'local',
  message: cloudInfo.user ? SYNC_STATUS.authenticated.message : SYNC_STATUS.local.message,
  error: '',
});

watch(
  state,
  () => {
    saveState(state);
  },
  { deep: true }
);

function replaceState(nextState) {
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, migrateState(nextState));
}

function localSnapshot() {
  return {
    version: state.version,
    settings: { ...state.settings },
    goals: state.goals.map((goal) => ({ ...goal })),
    tasks: state.tasks.map((task) => ({
      ...task,
      evidenceItems: (task.evidenceItems || []).map((item) => ({ ...item })),
      sessions: (task.sessions || []).map((item) => ({ ...item })),
    })),
    events: state.events.map((event) => ({ ...event })),
    reviews: state.reviews.map((review) => ({ ...review })),
  };
}

function setSyncStatus(status, error = '') {
  syncState.status = status;
  syncState.message = SYNC_STATUS[status]?.message || status;
  syncState.error = error;
  state.settings.syncStatus = status;
}

function runCloudSync(action) {
  if (!syncState.user) return;
  setSyncStatus('syncing');
  Promise.resolve()
    .then(action)
    .then(() => setSyncStatus('synced'))
    .catch((error) => setSyncStatus('failed', error.message || '同步失败'));
}

function syncSettingsSoon() {
  runCloudSync(() => saveSettingsToCloud(state.settings));
}

async function initializeCloudSync() {
  syncState.configured = getCloudSyncInfo().configured;
  const user = await getCurrentUser();
  syncState.user = user;
  setSyncStatus(user ? 'authenticated' : 'local');
}

subscribeAuthState((user) => {
  syncState.user = user;
  setSyncStatus(user ? 'authenticated' : 'local');
});

initializeCloudSync();

function goalLabel(level) {
  return goalLevels.find((item) => item.value === level)?.label || level;
}

function statusLabel(status) {
  return taskStatuses.find((item) => item.value === status)?.label || status;
}

function eventTypeLabel(type) {
  return eventTypes.find((item) => item.value === type)?.label || type;
}

function goalName(goalId) {
  return state.goals.find((goal) => goal.id === goalId)?.title || '未关联目标';
}

function tasksForDay(dayKey) {
  return state.tasks.filter((task) => task.date === dayKey || sameDay(task.deadline, dayKey) || sameDay(task.completedAt, dayKey));
}

function completionRateForDay(dayKey) {
  const list = tasksForDay(dayKey);
  if (!list.length) return 0;
  const progressTotal = list.reduce((sum, task) => sum + Number(task.progress || 0), 0);
  return Math.round(progressTotal / list.length);
}

function sortTasks(a, b) {
  const priorityDelta = priorities.indexOf(a.priority) - priorities.indexOf(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  if (b.score !== a.score) return b.score - a.score;
  return new Date(a.deadline || `${a.date}T23:59`) - new Date(b.deadline || `${b.date}T23:59`);
}

function rebalanceDailyPriorities(dayKey) {
  const sTasks = tasksForDay(dayKey)
    .filter((task) => task.priority === 'S' && task.status !== 'abandoned')
    .sort((a, b) => b.score - a.score);
  sTasks.forEach((task, index) => {
    if (index >= 2) task.priority = 'A';
  });
}

function updateCompoundScore(task) {
  task.compoundScore = Math.round(Number(task.score || 0) * (Number(task.progress || 0) / 100) * (Number(task.qualityScore || 0) / 100));
}

const getters = {
  categories: computed(() => state.settings.categories || defaultCategories),
  goalLevels,
  priorities,
  statuses: taskStatuses,
  eventTypes,
  evidenceTypes,
  todayKey: computed(() => todayKey()),
  activeDesk: computed(() => state.settings.activeDesk || 'today'),
  syncStatus: computed(() => ({
    ...(SYNC_STATUS[syncState.status] || SYNC_STATUS.local),
    message: syncState.error ? `${SYNC_STATUS.failed.message}：${syncState.error}` : syncState.message,
    user: syncState.user,
    configured: syncState.configured,
  })),
  availableMinutes: computed(() => Number(state.settings.customAvailableMinutes || 120)),
  goalsByLevel: computed(() => {
    return goalLevels.reduce((acc, level) => {
      acc[level.value] = state.goals.filter((goal) => goal.level === level.value);
      return acc;
    }, {});
  }),
  todayTasks: computed(() => tasksForDay(todayKey()).sort(sortTasks)),
  todayCompletionRate: computed(() => completionRateForDay(todayKey())),
  todayCompoundScore: computed(() => calculateDailyCompoundScore(tasksForDay(todayKey()))),
  todayTopThree: computed(() => tasksForDay(todayKey()).filter((task) => task.status !== 'abandoned').sort(sortTasks).slice(0, 3)),
  tenYearCountdown: computed(() => {
    const target = state.goals
      .filter((goal) => goal.level === 'ten_year' && goal.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    const end = target?.deadline || addDays(new Date(state.settings.appStartedAt), 3650);
    return {
      goalName: target?.title || '十年系统周期',
      daysLeft: Math.max(0, daysBetween(new Date(), end)),
      deadline: todayKey(new Date(end)),
    };
  }),
  sevenDayStats: computed(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = todayKey(addDays(new Date(), index - 6));
      const tasks = tasksForDay(date);
      return {
        date,
        label: date.slice(5),
        rate: completionRateForDay(date),
        compoundScore: calculateDailyCompoundScore(tasks),
      };
    });
  }),
  sevenDayAverageCompound: computed(() => {
    const list = getters.sevenDayStats.value;
    return Math.round(list.reduce((sum, day) => sum + day.compoundScore, 0) / list.length);
  }),
  streakDays: computed(() => {
    let count = 0;
    for (let offset = 0; offset > -365; offset -= 1) {
      const date = todayKey(addDays(new Date(), offset));
      const tasks = tasksForDay(date);
      const hasProgress = tasks.some((task) => task.progress > 0 || ['completed', 'partially_completed'].includes(task.status));
      const hasReview = state.reviews.some((review) => review.date === date);
      if (!hasProgress && !hasReview) break;
      count += 1;
    }
    return count;
  }),
};

function setActiveDesk(key) {
  state.settings.activeDesk = key;
  syncSettingsSoon();
}

function setTodayContext(patch) {
  Object.assign(state.settings, patch);
  syncSettingsSoon();
}

function addCategory(name) {
  const category = normalizeCategory(String(name || '').trim());
  if (!category || state.settings.categories.includes(category)) return;
  state.settings.categories.push(category);
  syncSettingsSoon();
}

function updateCategory(oldName, nextName) {
  const clean = normalizeCategory(String(nextName || '').trim());
  if (!clean) return;
  const old = normalizeCategory(oldName);
  state.settings.categories = state.settings.categories.map((category) => (category === old ? clean : category));
  state.goals.forEach((goal) => {
    if (goal.category === old) goal.category = clean;
  });
  state.tasks.forEach((task) => {
    if (task.category === old) task.category = clean;
  });
  syncSettingsSoon();
}

function deleteCategory(name) {
  const clean = normalizeCategory(name);
  if (defaultCategories.includes(clean)) return;
  state.settings.categories = state.settings.categories.filter((category) => category !== clean);
  syncSettingsSoon();
}

function addGoal(payload) {
  if (!payload?.title?.trim()) return null;
  const goal = normalizeGoal({
    ...payload,
    id: uid('goal'),
    title: payload.title.trim(),
  });
  state.goals.unshift(goal);
  addCategory(goal.category);
  runCloudSync(() => saveGoalToCloud(goal));
  return goal;
}

function updateGoal(id, patch) {
  const index = state.goals.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const goal = normalizeGoal({ ...state.goals[index], ...patch, id, updatedAt: nowIso() });
  state.goals[index] = goal;
  addCategory(goal.category);
  runCloudSync(() => saveGoalToCloud(goal));
  return goal;
}

function deleteGoal(id) {
  state.goals = state.goals.filter((goal) => goal.id !== id);
  state.goals.forEach((goal) => {
    if (goal.parentGoalId === id) goal.parentGoalId = '';
  });
  state.tasks.forEach((task) => {
    if (task.goalId === id) task.goalId = '';
  });
  runCloudSync(() => deleteGoalFromCloud(id));
}

function addTask(payload) {
  if (!payload?.title?.trim()) return null;
  const task = normalizeTask(
    {
      ...payload,
      id: uid('task'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    { date: payload.date || todayKey() }
  );
  if (task.score < 40) task.reason = [task.reason, lowScoreWarning(task.score)].filter(Boolean).join(' ');
  addCategory(task.category);
  state.tasks.unshift(task);
  rebalanceDailyPriorities(task.date);
  runCloudSync(() => saveTaskToCloud(task));
  return task;
}

function updateTask(id, patch) {
  const index = state.tasks.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = normalizeTask(
    {
      ...state.tasks[index],
      ...patch,
      id,
      updatedAt: nowIso(),
    },
    { date: patch.date || state.tasks[index].date }
  );
  addCategory(next.category);
  state.tasks[index] = next;
  rebalanceDailyPriorities(next.date);
  runCloudSync(() => saveTaskToCloud(next));
  return next;
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  runCloudSync(() => deleteTaskFromCloud(id));
}

function closeLastSession(task) {
  const session = [...task.sessions].reverse().find((item) => !item.end);
  if (!session) return;
  session.end = nowIso();
  session.seconds = Math.max(0, Math.round((new Date(session.end) - new Date(session.start)) / 1000));
  const totalSeconds = task.sessions.reduce((sum, item) => sum + Number(item.seconds || 0), 0);
  task.actualMinutes = Math.max(task.actualMinutes || 0, Math.round(totalSeconds / 60));
}

function startTask(id) {
  state.tasks.forEach((task) => {
    if (task.status === 'running' && task.id !== id) pauseTask(task.id);
  });
  const task = state.tasks.find((item) => item.id === id);
  if (!task || ['completed', 'abandoned'].includes(task.status)) return null;
  task.status = 'running';
  task.sessions.push({ start: nowIso(), end: null, seconds: 0 });
  task.updatedAt = nowIso();
  runCloudSync(() => saveTaskToCloud(task));
  return task;
}

function pauseTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.status !== 'running') return null;
  closeLastSession(task);
  task.status = 'paused';
  task.updatedAt = nowIso();
  runCloudSync(() => saveTaskToCloud(task));
  return task;
}

function finishTask(id, payload = {}) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return { ok: false, error: '任务不存在。' };
  if (task.status === 'running') closeLastSession(task);
  Object.assign(task, {
    progress: Number(payload.progress ?? task.progress ?? 100),
    qualityScore: Number(payload.qualityScore ?? task.qualityScore ?? 80),
    evidenceItems: Array.isArray(payload.evidenceItems) ? payload.evidenceItems.map(normalizeEvidenceItem) : task.evidenceItems,
  });
  task.progress = Math.max(0, Math.min(100, task.progress));
  task.qualityScore = Math.max(0, Math.min(100, task.qualityScore));

  if (task.progress >= 100 && task.requiresEvidence && !hasEvidence(task)) {
    task.status = 'paused';
    task.updatedAt = nowIso();
    runCloudSync(() => saveTaskToCloud(task));
    return {
      ok: false,
      error: '重要任务需要留下证据，避免伪努力。',
    };
  }

  task.status = task.progress >= 100 ? 'completed' : 'partially_completed';
  task.completedAt = nowIso();
  task.updatedAt = nowIso();
  updateCompoundScore(task);
  runCloudSync(() => saveTaskToCloud(task));
  return {
    ok: true,
    message: task.qualityScore < 60 ? '完成了，但质量偏低，建议复盘原因。' : '任务已记录。',
  };
}

function abandonTask(id, reason = '') {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return null;
  if (task.status === 'running') closeLastSession(task);
  task.status = 'abandoned';
  task.reason = reason || task.reason;
  task.updatedAt = nowIso();
  runCloudSync(() => saveTaskToCloud(task));
  return task;
}

function addEvent(payload) {
  if (!payload?.title?.trim()) return null;
  const event = normalizeEvent({
    ...payload,
    id: uid('event'),
    title: payload.title.trim(),
  });
  state.events.unshift(event);
  runCloudSync(() => saveEventToCloud(event));
  return event;
}

function deleteEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
  runCloudSync(() => deleteEventFromCloud(id));
}

function upsertReview(payload) {
  const existing = state.reviews.find((review) => review.date === payload.date);
  if (existing) {
    Object.assign(existing, normalizeReview({ ...existing, ...payload }), { updatedAt: nowIso() });
    runCloudSync(() => saveReviewToCloud(existing));
    return existing;
  }
  const review = normalizeReview({
    ...payload,
    id: uid('review'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  state.reviews.unshift(review);
  runCloudSync(() => saveReviewToCloud(review));
  return review;
}

function createRescueTask(task) {
  return addTask({
    title: `补救：${task.title}`,
    category: task.category,
    estimatedMinutes: Math.min(task.estimatedMinutes || 30, 45),
    date: todayKey(addDays(new Date(), 1)),
    goalId: task.goalId,
    requiresEvidence: task.requiresEvidence,
    reason: '来自未完成 S 级任务的次日补救。',
  });
}

function exportAllData() {
  const payload = createExportPayload(state);
  downloadJson(payload, `compound-life-system-v3.1.4-${todayKey()}.json`);
  return payload;
}

function importAllData(payload) {
  const result = validateImportPayload(payload);
  if (!result.ok) return result;
  replaceState(result.data);
  syncSettingsSoon();
  return { ok: true };
}

function resetAllData() {
  replaceState(createDefaultState());
  syncSettingsSoon();
}

async function signUp(email, password) {
  setSyncStatus('syncing');
  try {
    const data = await cloudSignUp(email, password);
    syncState.user = data?.user || null;
    setSyncStatus(syncState.user ? 'authenticated' : 'local');
    return { ok: true, data };
  } catch (error) {
    setSyncStatus('failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function signIn(email, password) {
  setSyncStatus('syncing');
  try {
    syncState.user = await cloudSignIn(email, password);
    setSyncStatus('authenticated');
    return { ok: true };
  } catch (error) {
    setSyncStatus('failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function signOut() {
  setSyncStatus('syncing');
  try {
    await cloudSignOut();
    syncState.user = null;
    setSyncStatus('local');
    return { ok: true };
  } catch (error) {
    setSyncStatus('failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function uploadLocalDataToCloud() {
  setSyncStatus('syncing');
  try {
    await uploadCloudData(localSnapshot());
    setSyncStatus('synced');
    return { ok: true };
  } catch (error) {
    setSyncStatus('failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function downloadCloudDataToLocal() {
  setSyncStatus('syncing');
  try {
    const cloudData = await downloadCloudData();
    replaceState({
      ...cloudData,
      settings: {
        ...state.settings,
        ...(cloudData.settings || {}),
      },
    });
    setSyncStatus('synced');
    return { ok: true };
  } catch (error) {
    setSyncStatus('failed', error.message);
    return { ok: false, error: error.message };
  }
}

function fakeEffortForTask(task) {
  return detectFakeEffort(task, state.tasks);
}

export function useAppStore() {
  return {
    state,
    getters,
    goalLabel,
    statusLabel,
    eventTypeLabel,
    evidenceTypeLabel,
    goalName,
    tasksForDay,
    completionRateForDay,
    fakeEffortForTask,
    calculateTaskScore,
    calculateDailyCompoundScore,
    detectFakeEffort,
    setActiveDesk,
    setTodayContext,
    addCategory,
    updateCategory,
    deleteCategory,
    addGoal,
    updateGoal,
    deleteGoal,
    addTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    finishTask,
    abandonTask,
    addEvent,
    deleteEvent,
    upsertReview,
    createRescueTask,
    exportAllData,
    importAllData,
    resetAllData,
    signUp,
    signIn,
    signOut,
    uploadLocalDataToCloud,
    downloadCloudDataToLocal,
  };
}
