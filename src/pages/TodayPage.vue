<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import StatCard from '../components/StatCard.vue';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, formatDuration, todayKey } from '../utils/date';
import {
  deleteEvidenceFile,
  deleteEvidenceItem,
  getEvidenceSignedUrl,
  saveEvidenceMetadata,
  uploadEvidenceFile,
  validateEvidenceFile,
} from '../services/fileUploadService';

const {
  state,
  getters,
  goalName,
  statusLabel,
  evidenceTypeLabel,
  fakeEffortForTask,
  addTask,
  updateTask,
  deleteTask,
  startTask,
  pauseTask,
  finishTask,
  abandonTask,
} = useAppStore();

const now = ref(new Date());
const notice = ref('');
const editingTaskId = ref('');
const expandedTaskId = ref('');
const taskForm = reactive(createEmptyTaskForm());
const evidenceDrafts = reactive({});
const fileUploadStates = reactive({});

let timer;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onBeforeUnmount(() => window.clearInterval(timer));

const dateText = computed(() =>
  now.value.toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);
const todayTasks = computed(() => getters.todayTasks.value);
const focusItems = computed(() => {
  return getters.todayTopThree.value.map((task) => ({ kind: 'task', task }));
});
const runningTask = computed(() => todayTasks.value.find((task) => task.status === 'running'));

function createEmptyTaskForm() {
  return {
    title: '',
    category: '学习成长',
    goalId: '',
    priority: 'B',
    score: 70,
    timeAmount: 30,
    timeUnit: 'minutes',
    deadline: '',
    date: todayKey(),
  };
}

function createEmptyEvidence() {
  return {
    editId: '',
    type: 'note',
    title: '',
    content: '',
    url: '',
  };
}

function createEmptyFileUploadState() {
  return {
    file: null,
    busy: false,
    message: '',
  };
}

function resetTaskForm() {
  editingTaskId.value = '';
  expandedTaskId.value = '';
  Object.assign(taskForm, createEmptyTaskForm());
}

function estimatedMinutesFromForm() {
  const value = Number(taskForm.timeAmount || 0);
  if (taskForm.timeUnit === 'hours') return Math.max(1, Math.round(value * 60));
  return Math.max(1, Math.round(value));
}

function applyTaskToForm(task) {
  editingTaskId.value = task.id;
  expandedTaskId.value = task.id;
  Object.assign(taskForm, {
    title: task.title,
    category: task.category,
    goalId: task.goalId,
    priority: task.priority,
    score: task.score,
    timeAmount: task.estimatedMinutes,
    timeUnit: 'minutes',
    deadline: task.deadline || '',
    date: task.date,
  });
}

function submitTask() {
  if (!taskForm.title.trim()) return;
  const payload = {
    title: taskForm.title,
    category: taskForm.category,
    goalId: taskForm.goalId,
    priority: taskForm.priority,
    score: Number(taskForm.score || 70),
    estimatedMinutes: estimatedMinutesFromForm(),
    deadline: taskForm.deadline,
    date: taskForm.date || todayKey(),
  };
  const saved = editingTaskId.value ? updateTask(editingTaskId.value, payload) : addTask(payload);
  notice.value = saved ? (editingTaskId.value ? '任务已保存。' : '任务已新增。') : '保存失败。';
  resetTaskForm();
}

function draftForTask(taskId) {
  if (!evidenceDrafts[taskId]) evidenceDrafts[taskId] = createEmptyEvidence();
  return evidenceDrafts[taskId];
}

function uploadStateForTask(taskId) {
  if (!fileUploadStates[taskId]) fileUploadStates[taskId] = createEmptyFileUploadState();
  return fileUploadStates[taskId];
}

function resetTaskEvidenceDraft(taskId) {
  evidenceDrafts[taskId] = createEmptyEvidence();
}

function resetTaskFileUpload(taskId) {
  fileUploadStates[taskId] = createEmptyFileUploadState();
}

function syncTaskState(task, patch = {}) {
  const saved = updateTask(task.id, {
    progress: Number(task.progress || 0),
    qualityScore: Number(task.qualityScore || 80),
    requiresEvidence: Boolean(task.requiresEvidence),
    evidenceItems: task.evidenceItems || [],
    ...patch,
  });
  if (saved) notice.value = '任务记录已更新。';
}

async function addOrUpdateTaskEvidence(task) {
  const draft = draftForTask(task.id);
  if (!draft.title.trim() && !draft.content.trim() && !draft.url.trim()) {
    notice.value = '请填写交付物标题、说明或链接。';
    return;
  }
  const items = (task.evidenceItems || []).map((entry) => ({ ...entry }));
  const index = items.findIndex((entry) => entry.id === draft.editId);
  const existing = index >= 0 ? items[index] : {};
  const item = {
    ...existing,
    id: draft.editId || `evidence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: draft.type,
    title: draft.title.trim() || evidenceTypeLabel(draft.type),
    content: draft.content.trim(),
    url: draft.url.trim(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) items[index] = item;
  else items.push(item);
  if (getters.syncStatus.value.user) {
    try {
      await saveEvidenceMetadata(task.id, item);
    } catch (error) {
      notice.value = error.message || '交付物云端元数据保存失败，本地已保留。';
    }
  }
  updateTask(task.id, { evidenceItems: items });
  resetTaskEvidenceDraft(task.id);
  notice.value = '交付物已保存。';
}

function editTaskEvidence(task, item) {
  Object.assign(draftForTask(task.id), {
    editId: item.id,
    type: item.type,
    title: item.title,
    content: item.content,
    url: item.url,
  });
}

async function removeTaskEvidence(task, item) {
  if (item.storagePath && !window.confirm('确认删除这个文件交付物吗？会同时删除云端文件。')) return;
  try {
    if (item.storagePath) await deleteEvidenceFile(item.storagePath);
    else await deleteEvidenceItem(item.id).catch(() => {});
    updateTask(task.id, { evidenceItems: (task.evidenceItems || []).filter((entry) => entry.id !== item.id) });
    notice.value = '交付物已删除。';
  } catch (error) {
    notice.value = error.message || '删除交付物失败。';
  }
}

function selectEvidenceFile(task, event) {
  const file = event.target.files?.[0] || null;
  const uploadState = uploadStateForTask(task.id);
  uploadState.file = file;
  uploadState.message = '';
  if (!file) return;
  const check = validateEvidenceFile(file);
  uploadState.message = check.ok ? `已选择：${file.name}` : check.error;
}

async function uploadTaskEvidenceFile(task) {
  if (!getters.syncStatus.value.user) {
    notice.value = '文件上传需要先登录。未登录时可以继续添加文字或链接交付物。';
    return;
  }
  const uploadState = uploadStateForTask(task.id);
  const file = uploadState.file;
  const check = validateEvidenceFile(file);
  if (!check.ok) {
    notice.value = check.error;
    return;
  }

  const draft = draftForTask(task.id);
  uploadState.busy = true;
  uploadState.message = '上传中...';
  try {
    const item = await uploadEvidenceFile(task.id, file, {
      type: draft.type === 'link' ? 'file' : draft.type,
      title: draft.title.trim() || file.name,
      content: draft.content.trim(),
      url: draft.url.trim(),
    });
    updateTask(task.id, { evidenceItems: [...(task.evidenceItems || []), item] });
    resetTaskEvidenceDraft(task.id);
    resetTaskFileUpload(task.id);
    notice.value = '文件交付物已上传。';
  } catch (error) {
    uploadState.message = error.message || '上传失败。';
    notice.value = uploadState.message;
  } finally {
    uploadState.busy = false;
  }
}

async function openEvidence(item) {
  try {
    if (item.storagePath) {
      const url = await getEvidenceSignedUrl(item.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    notice.value = '这个交付物没有可打开的文件或链接。';
  } catch (error) {
    notice.value = error.message || '打开文件失败。';
  }
}

function finish(task) {
  const result = finishTask(task.id, {
    progress: task.progress,
    qualityScore: task.qualityScore,
    evidenceItems: task.evidenceItems,
  });
  notice.value = result.ok ? result.message : result.error;
}

function removeTask(task) {
  if (!window.confirm(`确认删除任务「${task.title}」吗？`)) return;
  deleteTask(task.id);
  notice.value = '任务已删除。';
}

function elapsedSeconds(task) {
  if (!task) return 0;
  return (task.sessions || []).reduce((sum, session) => {
    if (session.end) return sum + Number(session.seconds || 0);
    return sum + Math.max(0, Math.round((now.value.getTime() - new Date(session.start).getTime()) / 1000));
  }, 0);
}

function remainingSeconds(task) {
  if (!task) return 0;
  return Math.max(0, Number(task.estimatedMinutes || 0) * 60 - elapsedSeconds(task));
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function countdownPercent(task) {
  if (!task?.estimatedMinutes) return 0;
  return Math.min(100, Math.round((elapsedSeconds(task) / (task.estimatedMinutes * 60)) * 100));
}

</script>

<template>
  <PageHeader title="今日台" eyebrow="Today">
    <div class="header-stack">
      <div class="clock">{{ dateText }}</div>
    </div>
  </PageHeader>

  <section class="today-hero">
    <div class="panel focus-panel">
      <div class="panel-title">
        <div>
          <h2>今日三件大事</h2>
          <span>由你在下方添加任务后自动显示前三件</span>
        </div>
      </div>

      <div v-if="!focusItems.length" class="empty-state">现在没有今日三件大事。请在下方新增任务，系统会按优先级和分数显示前三件。</div>
      <article v-for="item in focusItems" :key="`${item.kind}-${item.task.id || item.task.title}`" class="focus-card compact-task-card">
        <div>
          <span class="small-label">{{ item.task.priority }}级 · {{ item.task.score }}分</span>
          <h3>{{ item.task.title }}</h3>
          <p>{{ item.kind === 'task' ? goalName(item.task.goalId) : item.task.reason }}</p>
        </div>
        <div class="task-quick-meta">
          <span>{{ formatDuration(item.task.estimatedMinutes) }}</span>
          <span>{{ item.task.progress }}%</span>
          <button class="ghost-btn compact-btn" type="button" @click="applyTaskToForm(item.task)">编辑</button>
        </div>
      </article>
    </div>

    <div class="today-side">
      <section class="panel countdown-panel">
        <span class="small-label">当前执行</span>
        <h2>{{ runningTask ? runningTask.title : '未开始任务' }}</h2>
        <strong class="countdown-time">{{ runningTask ? formatClock(remainingSeconds(runningTask)) : '--:--' }}</strong>
        <div class="countdown-track"><i :style="{ width: `${runningTask ? countdownPercent(runningTask) : 0}%` }"></i></div>
        <p>
          {{
            runningTask
              ? `已用 ${formatClock(elapsedSeconds(runningTask))} / 预计 ${formatDuration(runningTask.estimatedMinutes)}`
              : '点击任务台的开始按钮后，这里会实时倒计时。'
          }}
        </p>
      </section>

      <section class="stat-grid today-stats">
        <StatCard label="今日复利分" :value="getters.todayCompoundScore.value" hint="分数×进度×质量" />
        <StatCard label="今日完成率" :value="`${getters.todayCompletionRate.value}%`" hint="按进度计算" />
      </section>
    </div>
  </section>

  <section class="layout-with-form task-workspace">
    <form class="panel form-panel task-edit-form" @submit.prevent="submitTask">
      <h2>{{ editingTaskId ? '编辑任务' : '新增任务' }}</h2>
      <label>
        任务名称
        <input v-model.trim="taskForm.title" required placeholder="例如：完成一组练习并记录错因" />
      </label>
      <div class="form-grid">
        <label>
          分类
          <select v-model="taskForm.category">
            <option v-for="category in getters.categories.value" :key="category">{{ category }}</option>
          </select>
        </label>
        <label>
          所属目标
          <select v-model="taskForm.goalId">
            <option value="">未关联目标</option>
            <option v-for="goal in state.goals" :key="goal.id" :value="goal.id">{{ goal.title }}</option>
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label>
          预计用时
          <div class="time-input-row">
            <input
              v-model.number="taskForm.timeAmount"
              class="duration-number"
              type="number"
              min="1"
              :step="taskForm.timeUnit === 'hours' ? 0.5 : 1"
            />
            <select v-model="taskForm.timeUnit">
              <option value="minutes">分钟</option>
              <option value="hours">小时</option>
            </select>
          </div>
        </label>
        <label>
          截止时间
          <input v-model="taskForm.deadline" type="datetime-local" />
        </label>
      </div>
      <div class="form-grid">
        <label>
          优先级
          <select v-model="taskForm.priority">
            <option v-for="priority in getters.priorities" :key="priority">{{ priority }}</option>
          </select>
        </label>
        <label>
          分数
          <input v-model.number="taskForm.score" type="number" min="0" max="100" step="1" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-btn" type="submit">{{ editingTaskId ? '保存任务' : '新增任务' }}</button>
        <button class="ghost-btn" type="button" @click="resetTaskForm">清空</button>
      </div>
    </form>

    <div class="panel">
      <div class="panel-title">
        <h2>任务台</h2>
        <span>{{ todayTasks.length }} 项</span>
      </div>
      <div v-if="!todayTasks.length" class="empty-state">今天还没有任务。</div>
      <article v-for="task in todayTasks" :key="task.id" class="task-card compact-task-card">
        <div class="task-card-summary">
          <div>
            <span class="small-label">{{ task.priority }}级 · {{ task.score }}分 · {{ goalName(task.goalId) }}</span>
            <h3>{{ task.title }}</h3>
            <div class="meta-row">
              <span>预计 {{ formatDuration(task.estimatedMinutes) }}</span>
              <span>进度 {{ task.progress }}%</span>
              <span>交付物 {{ task.evidenceItems?.length || 0 }}</span>
            </div>
          </div>
          <span class="status-pill" :class="task.status">{{ statusLabel(task.status) }}</span>
        </div>
        <div class="progress-line"><i :style="{ width: `${task.progress}%` }"></i></div>
        <div class="slider-grid task-control-grid">
          <label>
            完成进度 {{ task.progress }}%
            <input v-model.number="task.progress" type="range" min="0" max="100" step="5" @change="syncTaskState(task)" />
          </label>
          <label>
            完成质量 {{ task.qualityScore }}分
            <input v-model.number="task.qualityScore" type="range" min="0" max="100" step="5" @change="syncTaskState(task)" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary-btn compact-btn" type="button" :disabled="task.status === 'running'" @click="startTask(task.id)">开始</button>
          <button class="ghost-btn compact-btn" type="button" :disabled="task.status !== 'running'" @click="pauseTask(task.id)">暂停</button>
          <button class="ghost-btn compact-btn" type="button" @click="finish(task)">完成/结束</button>
          <button class="ghost-btn compact-btn" type="button" @click="applyTaskToForm(task)">编辑</button>
          <button class="danger-btn compact-btn" type="button" @click="removeTask(task)">删除</button>
        </div>
        <details class="task-details">
          <summary>展开详情</summary>
          <p>分类：{{ task.category }} · 实际 {{ formatDuration(task.actualMinutes) }} · 质量 {{ task.qualityScore }}分</p>
          <p v-if="task.deadline">截止：{{ formatDateTime(task.deadline) }}</p>
          <label class="checkbox-line">
            <input v-model="task.requiresEvidence" type="checkbox" @change="syncTaskState(task)" />
            重要任务需要交付物
          </label>
          <section class="evidence-editor task-evidence-editor">
            <div class="panel-title tight-title">
              <h3>交付物列表</h3>
              <span>{{ task.evidenceItems?.length || 0 }} 个</span>
            </div>
            <div v-if="!task.evidenceItems?.length" class="empty-line">重要任务需要留下证据，避免伪努力。</div>
            <article v-for="item in task.evidenceItems" :key="item.id" class="evidence-item">
              <div>
                <strong>{{ evidenceTypeLabel(item.type) }} · {{ item.title }}</strong>
                <p>{{ item.content || item.url || item.fileName || '无说明' }}</p>
                <small v-if="item.fileName">{{ item.fileName }} · {{ Math.ceil((item.fileSize || 0) / 1024) }} KB</small>
              </div>
              <div class="button-row tight">
                <button v-if="item.storagePath || item.url" class="ghost-btn compact-btn" type="button" @click="openEvidence(item)">打开</button>
                <button class="ghost-btn compact-btn" type="button" @click="editTaskEvidence(task, item)">编辑</button>
                <button class="danger-btn compact-btn" type="button" @click="removeTaskEvidence(task, item)">删除</button>
              </div>
            </article>
            <div class="evidence-form">
              <div class="evidence-mode-row">
                <span>添加文字证据 / 链接证据 / 上传文件</span>
                <small v-if="!getters.syncStatus.value.user">文件上传需登录；文字和链接可继续本地保存。</small>
              </div>
              <div class="form-grid">
                <label>
                  类型
                  <select v-model="draftForTask(task.id).type">
                    <option v-for="type in getters.evidenceTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
                  </select>
                </label>
                <label>
                  标题
                  <input v-model.trim="draftForTask(task.id).title" placeholder="例如：练习截图说明" />
                </label>
              </div>
              <label>
                说明
                <textarea v-model.trim="draftForTask(task.id).content" rows="2" placeholder="本阶段不上传文件，先写文字说明。"></textarea>
              </label>
              <label>
                链接
                <input v-model.trim="draftForTask(task.id).url" placeholder="可选：截图链接、代码链接、录音链接" />
              </label>
              <button class="ghost-btn full-btn" type="button" @click="addOrUpdateTaskEvidence(task)">
                {{ draftForTask(task.id).editId ? '保存交付物' : '添加交付物' }}
              </button>
              <div class="file-upload-box">
                <label>
                  上传文件
                  <input
                    type="file"
                    accept="image/*,application/pdf,audio/*,text/*,.txt,.md,.js,.ts,.vue,.json,.py,.c,.cpp,.java,.zip"
                    :disabled="!getters.syncStatus.value.user || uploadStateForTask(task.id).busy"
                    @change="selectEvidenceFile(task, $event)"
                  />
                </label>
                <div class="button-row">
                  <button
                    class="primary-btn compact-btn"
                    type="button"
                    :disabled="!getters.syncStatus.value.user || uploadStateForTask(task.id).busy"
                    @click="uploadTaskEvidenceFile(task)"
                  >
                    {{ uploadStateForTask(task.id).busy ? '上传中...' : '上传文件' }}
                  </button>
                  <span v-if="uploadStateForTask(task.id).message" class="upload-message">{{ uploadStateForTask(task.id).message }}</span>
                </div>
              </div>
            </div>
          </section>
          <div v-if="fakeEffortForTask(task).warnings.length" class="warning-box">
            <strong>伪努力提醒</strong>
            <span v-for="warning in fakeEffortForTask(task).warnings" :key="warning">{{ warning }}</span>
          </div>
          <button class="danger-btn compact-btn" type="button" @click="abandonTask(task.id, '今日主动放弃')">放弃任务</button>
        </details>
      </article>
    </div>
  </section>

  <p v-if="notice" class="inline-notice floating-notice">{{ notice }}</p>
</template>
