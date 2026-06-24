import { computed, reactive, watch } from 'vue';
import { addDays, daysBetween, sameDay, todayKey } from '../utils/date';

const STORAGE_KEY = 'compound-life-system-state';
const categories = ['学习', '健康', '职业', '关系', '财务', '创造', '生活'];
const goalLevels = [
  { value: '10y', label: '10年目标' },
  { value: '3y', label: '3年目标' },
  { value: '1y', label: '1年目标' },
  { value: 'month', label: '月目标' },
];
const priorities = ['S', 'A', 'B', 'C'];
const statuses = [
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '执行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'done', label: '已完成' },
];
const eventTypes = [
  { value: 'positive', label: '正面事件' },
  { value: 'negative', label: '负面事件' },
  { value: 'opportunity', label: '机会事件' },
  { value: 'risk', label: '风险事件' },
];

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultState() {
  return {
    version: 1,
    settings: {
      appStartedAt: nowIso(),
    },
    goals: [],
    tasks: [],
    events: [],
    reviews: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return { ...createDefaultState(), ...JSON.parse(raw) };
  } catch {
    return createDefaultState();
  }
}

const state = reactive(loadState());

watch(
  state,
  () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  { deep: true }
);

function goalLabel(level) {
  return goalLevels.find((item) => item.value === level)?.label || level;
}

function statusLabel(status) {
  return statuses.find((item) => item.value === status)?.label || status;
}

function eventTypeLabel(type) {
  return eventTypes.find((item) => item.value === type)?.label || type;
}

function goalName(goalId) {
  return state.goals.find((goal) => goal.id === goalId)?.name || '未关联目标';
}

function priorityWeight(priority) {
  return { S: 22, A: 16, B: 10, C: 6 }[priority] || 4;
}

function tasksForDay(dayKey) {
  return state.tasks.filter((task) => sameDay(task.dueAt, dayKey) || sameDay(task.completedAt, dayKey));
}

function completionRateForDay(dayKey) {
  const list = tasksForDay(dayKey);
  if (!list.length) return 0;
  return Math.round((list.filter((task) => task.status === 'done').length / list.length) * 100);
}

const getters = {
  categories,
  goalLevels,
  priorities,
  statuses,
  eventTypes,
  todayKey: computed(() => todayKey()),
  goalsByLevel: computed(() => {
    return goalLevels.reduce((acc, level) => {
      acc[level.value] = state.goals.filter((goal) => goal.level === level.value);
      return acc;
    }, {});
  }),
  todayTasks: computed(() => tasksForDay(todayKey()).sort(sortTasks)),
  todayCompletionRate: computed(() => completionRateForDay(todayKey())),
  todayTopThree: computed(() => {
    const openToday = tasksForDay(todayKey()).filter((task) => task.status !== 'done');
    const fallback = state.tasks.filter((task) => task.status !== 'done');
    return (openToday.length ? openToday : fallback).sort(sortTasks).slice(0, 3);
  }),
  compoundScore: computed(() => {
    return state.tasks
      .filter((task) => sameDay(task.completedAt))
      .reduce((sum, task) => sum + priorityWeight(task.priority) + Number(task.quality || 0) * 2, 0);
  }),
  tenYearCountdown: computed(() => {
    const target = state.goals
      .filter((goal) => goal.level === '10y' && goal.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    const end = target?.deadline || addDays(new Date(state.settings.appStartedAt), 3650);
    return {
      goalName: target?.name || '十年系统周期',
      daysLeft: Math.max(0, daysBetween(new Date(), end)),
      deadline: todayKey(new Date(end)),
    };
  }),
  sevenDayRates: computed(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const day = todayKey(addDays(new Date(), index - 6));
      return {
        date: day,
        label: day.slice(5),
        rate: completionRateForDay(day),
      };
    });
  }),
  categoryTaskCounts: computed(() => {
    return categories.map((category) => ({
      category,
      count: state.tasks.filter((task) => task.category === category).length,
      done: state.tasks.filter((task) => task.category === category && task.status === 'done').length,
    }));
  }),
  streakDays: computed(() => {
    let count = 0;
    for (let offset = 0; offset > -365; offset -= 1) {
      const day = todayKey(addDays(new Date(), offset));
      const hasDoneTask = state.tasks.some((task) => sameDay(task.completedAt, day));
      const hasReview = state.reviews.some((review) => review.date === day);
      if (!hasDoneTask && !hasReview) break;
      count += 1;
    }
    return count;
  }),
  delayedTasks: computed(() => {
    const today = new Date();
    return state.tasks
      .map((task) => {
        if (!task.dueAt) return null;
        const due = new Date(task.dueAt);
        const completed = task.completedAt ? new Date(task.completedAt) : null;
        const delayedDays =
          task.status === 'done' && completed > due
            ? daysBetween(due, completed)
            : task.status !== 'done' && today > due
              ? daysBetween(due, today)
              : 0;
        return delayedDays > 0 ? { ...task, delayedDays } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.delayedDays - a.delayedDays)
      .slice(0, 5);
  }),
};

function sortTasks(a, b) {
  const priorityDelta = priorities.indexOf(a.priority) - priorities.indexOf(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  return new Date(a.dueAt || '2999-12-31') - new Date(b.dueAt || '2999-12-31');
}

function addGoal(payload) {
  state.goals.unshift({
    id: uid('goal'),
    level: payload.level || '1y',
    name: payload.name.trim(),
    category: payload.category || categories[0],
    deadline: payload.deadline || '',
    reason: payload.reason?.trim() || '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function updateGoal(id, patch) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  Object.assign(goal, patch, { updatedAt: nowIso() });
}

function deleteGoal(id) {
  state.goals = state.goals.filter((goal) => goal.id !== id);
  state.tasks.forEach((task) => {
    if (task.goalId === id) task.goalId = '';
  });
}

function addTask(payload) {
  state.tasks.unshift({
    id: uid('task'),
    title: payload.title.trim(),
    category: payload.category || categories[0],
    priority: payload.priority || 'B',
    estimatedMinutes: Number(payload.estimatedMinutes || 30),
    dueAt: payload.dueAt || '',
    goalId: payload.goalId || '',
    status: payload.status || 'todo',
    actualSeconds: 0,
    quality: 0,
    blockers: '',
    evidence: '',
    sessions: [],
    completedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function updateTask(id, patch) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  Object.assign(task, patch, { updatedAt: nowIso() });
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
}

function startTask(id) {
  state.tasks.forEach((task) => {
    if (task.status === 'doing' && task.id !== id) pauseTask(task.id);
  });
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.status === 'done') return;
  task.status = 'doing';
  task.sessions.push({ start: nowIso(), end: null, seconds: 0 });
  task.updatedAt = nowIso();
}

function pauseTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.status !== 'doing') return;
  closeLastSession(task);
  task.status = 'paused';
  task.updatedAt = nowIso();
}

function completeTask(id, payload = {}) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  if (task.status === 'doing') closeLastSession(task);
  task.status = 'done';
  task.quality = Number(payload.quality || task.quality || 3);
  task.blockers = payload.blockers ?? task.blockers;
  task.evidence = payload.evidence ?? task.evidence;
  task.completedAt = nowIso();
  task.updatedAt = nowIso();
}

function closeLastSession(task) {
  const session = [...task.sessions].reverse().find((item) => !item.end);
  if (!session) return;
  session.end = nowIso();
  session.seconds = Math.max(0, Math.round((new Date(session.end) - new Date(session.start)) / 1000));
  task.actualSeconds = task.sessions.reduce((sum, item) => sum + Number(item.seconds || 0), 0);
}

function addEvent(payload) {
  state.events.unshift({
    id: uid('event'),
    date: payload.date || todayKey(),
    type: payload.type || 'positive',
    title: payload.title.trim(),
    description: payload.description?.trim() || '',
    createdAt: nowIso(),
  });
}

function deleteEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
}

function upsertReview(payload) {
  const existing = state.reviews.find((review) => review.date === payload.date);
  if (existing) {
    Object.assign(existing, payload, { updatedAt: nowIso() });
    return;
  }
  state.reviews.unshift({
    id: uid('review'),
    date: payload.date || todayKey(),
    done: '',
    problems: '',
    shortcomings: '',
    reasons: '',
    improvements: '',
    gains: '',
    tomorrowFocus: '',
    ...payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function resetAllData() {
  const fresh = createDefaultState();
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, fresh);
}

export function useAppStore() {
  return {
    state,
    getters,
    goalLabel,
    statusLabel,
    eventTypeLabel,
    goalName,
    addGoal,
    updateGoal,
    deleteGoal,
    addTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    completeTask,
    addEvent,
    deleteEvent,
    upsertReview,
    resetAllData,
  };
}
