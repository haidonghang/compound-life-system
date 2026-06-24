<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import StatCard from '../components/StatCard.vue';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../utils/date';

const { getters, goalName, statusLabel } = useAppStore();
const now = ref(new Date());
let timer;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => window.clearInterval(timer));

const dateText = computed(() =>
  now.value.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);
</script>

<template>
  <PageHeader title="首页" eyebrow="Today">
    <div class="clock">{{ dateText }}</div>
  </PageHeader>

  <section class="stat-grid">
    <StatCard label="今日完成率" :value="`${getters.todayCompletionRate.value}%`" hint="按今日相关任务计算" />
    <StatCard label="今日复利分" :value="getters.compoundScore.value" hint="优先级与完成质量加权" />
    <StatCard label="连续执行" :value="`${getters.streakDays.value} 天`" hint="完成任务或复盘均计入" />
    <StatCard
      label="十年倒计时"
      :value="`${getters.tenYearCountdown.value.daysLeft} 天`"
      :hint="`${getters.tenYearCountdown.value.goalName} · ${getters.tenYearCountdown.value.deadline}`"
    />
  </section>

  <section class="content-grid two">
    <div class="panel">
      <div class="panel-title">
        <h2>今日三件大事</h2>
        <span>{{ getters.todayTopThree.value.length }}/3</span>
      </div>
      <div v-if="!getters.todayTopThree.value.length" class="empty-state">
        还没有今日任务。去任务页添加三件最值得推进的事。
      </div>
      <article v-for="task in getters.todayTopThree.value" :key="task.id" class="list-item">
        <div>
          <div class="item-title">{{ task.title }}</div>
          <div class="item-meta">{{ task.priority }} · {{ task.category }} · {{ goalName(task.goalId) }}</div>
        </div>
        <span class="status-pill" :class="task.status">{{ statusLabel(task.status) }}</span>
      </article>
    </div>

    <div class="panel">
      <div class="panel-title">
        <h2>今日任务流</h2>
        <span>{{ getters.todayTasks.value.length }} 项</span>
      </div>
      <div v-if="!getters.todayTasks.value.length" class="empty-state">
        今日没有截止或完成的任务。
      </div>
      <article v-for="task in getters.todayTasks.value" :key="task.id" class="list-item compact">
        <div>
          <div class="item-title">{{ task.title }}</div>
          <div class="item-meta">截止 {{ formatDateTime(task.dueAt) }}</div>
        </div>
        <span class="priority-badge">{{ task.priority }}</span>
      </article>
    </div>
  </section>
</template>
