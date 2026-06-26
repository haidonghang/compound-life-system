<script setup>
import { computed, reactive, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';

const {
  state,
  getters,
  goalLabel,
  addCategory,
  updateCategory,
  deleteCategory,
  addGoal,
  updateGoal,
  deleteGoal,
} = useAppStore();

const editingId = ref('');
const editingCategory = ref('');
const categoryName = ref('');
const notice = ref('');
const form = reactive(createEmptyGoalForm());

const groupedGoals = computed(() =>
  getters.goalLevels.reduce((acc, level) => {
    acc[level.value] = state.goals.filter((goal) => goal.level === level.value);
    return acc;
  }, {})
);
const parentCandidates = computed(() => state.goals.filter((goal) => goal.id !== editingId.value));

function createEmptyGoalForm() {
  return {
    level: 'one_year',
    title: '',
    description: '',
    category: '学习成长',
    deadline: '',
    parentGoalId: '',
  };
}

function resetForm() {
  editingId.value = '';
  Object.assign(form, createEmptyGoalForm());
}

function submit() {
  if (!form.title.trim()) return;
  const payload = {
    level: form.level,
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim() || '其他',
    deadline: form.deadline,
    parentGoalId: form.parentGoalId,
  };
  if (editingId.value) updateGoal(editingId.value, payload);
  else addGoal(payload);
  notice.value = editingId.value ? '目标已更新。' : '目标已添加。';
  resetForm();
}

function edit(goal) {
  editingId.value = goal.id;
  Object.assign(form, {
    level: goal.level,
    title: goal.title,
    description: goal.description,
    category: goal.category,
    deadline: goal.deadline,
    parentGoalId: goal.parentGoalId,
  });
}

function remove(goal) {
  if (!window.confirm(`确认删除目标「${goal.title}」吗？相关任务会变为未关联。`)) return;
  deleteGoal(goal.id);
  notice.value = '目标已删除。';
}

function saveCategory() {
  const value = categoryName.value.trim();
  if (!value) return;
  if (editingCategory.value) updateCategory(editingCategory.value, value);
  else addCategory(value);
  notice.value = editingCategory.value ? '分类已更新。' : '分类已添加。';
  editingCategory.value = '';
  categoryName.value = '';
}

function editCategory(category) {
  editingCategory.value = category;
  categoryName.value = category;
}

function removeCategory(category) {
  if (!window.confirm(`确认删除分类「${category}」吗？默认分类不会被删除。`)) return;
  deleteCategory(category);
}
</script>

<template>
  <PageHeader title="目标台" eyebrow="Goals">
    <div class="header-stack">
      <span class="sync-pill">十年 → 五年 → 三年 → 一年 → 月 → 周 → 日</span>
    </div>
  </PageHeader>

  <section class="layout-with-form goals-layout">
    <form class="panel form-panel" @submit.prevent="submit">
      <h2>{{ editingId ? '编辑目标' : '新增目标' }}</h2>
      <div class="form-grid">
        <label>
          层级
          <select v-model="form.level">
            <option v-for="level in getters.goalLevels" :key="level.value" :value="level.value">{{ level.label }}</option>
          </select>
        </label>
        <label>
          分类
          <select v-model="form.category">
            <option v-for="category in getters.categories.value" :key="category">{{ category }}</option>
          </select>
        </label>
      </div>
      <label>
        目标名称
        <input v-model.trim="form.title" required placeholder="例如：今年完成一个可展示作品" />
      </label>
      <label>
        目标说明
        <textarea v-model.trim="form.description" rows="3" placeholder="写清楚为什么重要、做到什么程度算完成"></textarea>
      </label>
      <div class="form-grid">
        <label>
          截止日期
          <input v-model="form.deadline" type="date" />
        </label>
        <label>
          上一级目标
          <select v-model="form.parentGoalId">
            <option value="">不关联</option>
            <option v-for="goal in parentCandidates" :key="goal.id" :value="goal.id">
              {{ goalLabel(goal.level) }} · {{ goal.title }}
            </option>
          </select>
        </label>
      </div>
      <div class="button-row">
        <button class="primary-btn" type="submit">{{ editingId ? '保存目标' : '添加目标' }}</button>
        <button class="ghost-btn" type="button" @click="resetForm">清空</button>
      </div>
    </form>

    <div class="panel">
      <div class="panel-title">
        <h2>目标阶梯</h2>
        <span>{{ state.goals.length }} 项</span>
      </div>
      <div v-for="level in getters.goalLevels" :key="level.value" class="goal-level">
        <div class="level-title">{{ level.label }}</div>
        <div v-if="!groupedGoals[level.value]?.length" class="empty-line">暂无</div>
        <article v-for="goal in groupedGoals[level.value]" :key="goal.id" class="goal-row">
          <div>
            <span class="small-label">{{ goal.category }} · {{ goal.deadline || '未设截止' }}</span>
            <h3>{{ goal.title }}</h3>
            <p>{{ goal.description || '未填写说明' }}</p>
            <small v-if="goal.parentGoalId">上级：{{ state.goals.find((item) => item.id === goal.parentGoalId)?.title || '已删除' }}</small>
          </div>
          <div class="record-actions">
            <button class="ghost-btn" type="button" @click="edit(goal)">编辑</button>
            <button class="danger-btn" type="button" @click="remove(goal)">删除</button>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-title">
      <div>
        <h2>自定义分类</h2>
        <span>任务和目标共用，可按考研、学习、运动、项目等自己命名</span>
      </div>
    </div>
    <div class="category-list">
      <span v-for="category in getters.categories.value" :key="category" class="category-chip">
        {{ category }}
        <button type="button" @click="editCategory(category)">改</button>
        <button type="button" @click="removeCategory(category)">删</button>
      </span>
    </div>
    <div class="category-form">
      <input v-model.trim="categoryName" placeholder="新增或修改分类名称" />
      <button class="ghost-btn" type="button" @click="saveCategory">{{ editingCategory ? '保存分类' : '添加分类' }}</button>
    </div>
  </section>

  <p v-if="notice" class="inline-notice floating-notice">{{ notice }}</p>
</template>
