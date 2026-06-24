<script setup>
import { reactive, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';

const { state, getters, goalLabel, addGoal, updateGoal, deleteGoal } = useAppStore();
const editingId = ref('');
const form = reactive({
  level: '10y',
  name: '',
  category: '学习',
  deadline: '',
  reason: '',
});

function resetForm() {
  editingId.value = '';
  Object.assign(form, { level: '10y', name: '', category: '学习', deadline: '', reason: '' });
}

function submit() {
  if (!form.name.trim()) return;
  if (editingId.value) updateGoal(editingId.value, { ...form, name: form.name.trim(), reason: form.reason.trim() });
  else addGoal(form);
  resetForm();
}

function edit(goal) {
  editingId.value = goal.id;
  Object.assign(form, {
    level: goal.level,
    name: goal.name,
    category: goal.category,
    deadline: goal.deadline,
    reason: goal.reason,
  });
}
</script>

<template>
  <PageHeader title="目标页" eyebrow="Goal Architecture" />

  <section class="layout-with-form">
    <form class="panel form-panel" @submit.prevent="submit">
      <h2>{{ editingId ? '编辑目标' : '添加目标' }}</h2>
      <label>
        目标层级
        <select v-model="form.level">
          <option v-for="level in getters.goalLevels" :key="level.value" :value="level.value">{{ level.label }}</option>
        </select>
      </label>
      <label>
        目标名称
        <input v-model.trim="form.name" required placeholder="例如：成为具备作品集的产品工程师" />
      </label>
      <label>
        分类
        <select v-model="form.category">
          <option v-for="category in getters.categories" :key="category">{{ category }}</option>
        </select>
      </label>
      <label>
        截止日期
        <input v-model="form.deadline" type="date" />
      </label>
      <label>
        重要原因
        <textarea v-model.trim="form.reason" rows="4" placeholder="写清楚为什么这个目标值得长期投入"></textarea>
      </label>
      <div class="button-row">
        <button class="primary-btn" type="submit">{{ editingId ? '保存目标' : '添加目标' }}</button>
        <button class="ghost-btn" type="button" @click="resetForm">清空</button>
      </div>
    </form>

    <div class="panel">
      <div class="panel-title">
        <h2>目标列表</h2>
        <span>{{ state.goals.length }} 项</span>
      </div>
      <div v-if="!state.goals.length" class="empty-state">从一个 10 年目标开始，再向下拆到年度和月度。</div>
      <article v-for="goal in state.goals" :key="goal.id" class="record-card">
        <div class="record-main">
          <span class="small-label">{{ goalLabel(goal.level) }} · {{ goal.category }}</span>
          <h3>{{ goal.name }}</h3>
          <p>{{ goal.reason || '未填写重要原因' }}</p>
          <small>截止：{{ goal.deadline || '未设置' }}</small>
        </div>
        <div class="record-actions">
          <button class="ghost-btn" type="button" @click="edit(goal)">编辑</button>
          <button class="danger-btn" type="button" @click="deleteGoal(goal.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
