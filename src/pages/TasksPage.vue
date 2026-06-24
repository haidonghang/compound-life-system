<script setup>
import { reactive, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, toDateTimeLocal } from '../utils/date';

const { state, getters, goalName, statusLabel, addTask, updateTask, deleteTask } = useAppStore();
const editingId = ref('');
const form = reactive({
  title: '',
  category: '学习',
  priority: 'B',
  estimatedMinutes: 30,
  dueAt: toDateTimeLocal(),
  goalId: '',
  status: 'todo',
});

function resetForm() {
  editingId.value = '';
  Object.assign(form, {
    title: '',
    category: '学习',
    priority: 'B',
    estimatedMinutes: 30,
    dueAt: toDateTimeLocal(),
    goalId: '',
    status: 'todo',
  });
}

function submit() {
  if (!form.title.trim()) return;
  const payload = {
    ...form,
    title: form.title.trim(),
    estimatedMinutes: Number(form.estimatedMinutes || 0),
  };
  if (editingId.value) updateTask(editingId.value, payload);
  else addTask(payload);
  resetForm();
}

function edit(task) {
  editingId.value = task.id;
  Object.assign(form, {
    title: task.title,
    category: task.category,
    priority: task.priority,
    estimatedMinutes: task.estimatedMinutes,
    dueAt: task.dueAt,
    goalId: task.goalId,
    status: task.status,
  });
}
</script>

<template>
  <PageHeader title="任务页" eyebrow="Task System" />

  <section class="layout-with-form">
    <form class="panel form-panel" @submit.prevent="submit">
      <h2>{{ editingId ? '编辑任务' : '新增任务' }}</h2>
      <label>
        任务名
        <input v-model.trim="form.title" required placeholder="例如：完成英语阅读 2 篇" />
      </label>
      <div class="form-grid">
        <label>
          分类
          <select v-model="form.category">
            <option v-for="category in getters.categories" :key="category">{{ category }}</option>
          </select>
        </label>
        <label>
          优先级
          <select v-model="form.priority">
            <option v-for="priority in getters.priorities" :key="priority">{{ priority }}</option>
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label>
          预计时间
          <input v-model.number="form.estimatedMinutes" type="number" min="1" step="5" />
        </label>
        <label>
          截止时间
          <input v-model="form.dueAt" type="datetime-local" />
        </label>
      </div>
      <label>
        所属目标
        <select v-model="form.goalId">
          <option value="">未关联目标</option>
          <option v-for="goal in state.goals" :key="goal.id" :value="goal.id">{{ goal.name }}</option>
        </select>
      </label>
      <label>
        状态
        <select v-model="form.status">
          <option v-for="status in getters.statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
      </label>
      <div class="button-row">
        <button class="primary-btn" type="submit">{{ editingId ? '保存任务' : '新增任务' }}</button>
        <button class="ghost-btn" type="button" @click="resetForm">清空</button>
      </div>
    </form>

    <div class="panel">
      <div class="panel-title">
        <h2>任务清单</h2>
        <span>{{ state.tasks.length }} 项</span>
      </div>
      <div v-if="!state.tasks.length" class="empty-state">把月目标拆成今天能执行的动作。</div>
      <article v-for="task in state.tasks" :key="task.id" class="record-card">
        <div class="record-main">
          <span class="small-label">{{ task.priority }} · {{ task.category }} · {{ statusLabel(task.status) }}</span>
          <h3>{{ task.title }}</h3>
          <p>所属目标：{{ goalName(task.goalId) }}</p>
          <small>预计 {{ task.estimatedMinutes }} 分钟 · 截止 {{ formatDateTime(task.dueAt) }}</small>
        </div>
        <div class="record-actions">
          <button class="ghost-btn" type="button" @click="edit(task)">编辑</button>
          <button class="danger-btn" type="button" @click="deleteTask(task.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
