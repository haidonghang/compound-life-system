<script setup>
import { computed, ref } from 'vue';
import DashboardPage from './pages/DashboardPage.vue';
import GoalsPage from './pages/GoalsPage.vue';
import TasksPage from './pages/TasksPage.vue';
import ExecutePage from './pages/ExecutePage.vue';
import EventsPage from './pages/EventsPage.vue';
import ReviewPage from './pages/ReviewPage.vue';
import DataPage from './pages/DataPage.vue';

const tabs = [
  { key: 'dashboard', label: '首页', component: DashboardPage },
  { key: 'goals', label: '目标', component: GoalsPage },
  { key: 'tasks', label: '任务', component: TasksPage },
  { key: 'execute', label: '执行', component: ExecutePage },
  { key: 'events', label: '事件', component: EventsPage },
  { key: 'review', label: '复盘', component: ReviewPage },
  { key: 'data', label: '数据', component: DataPage },
];

const active = ref(localStorage.getItem('compound-life-system-tab') || 'dashboard');
const current = computed(() => tabs.find((tab) => tab.key === active.value)?.component || DashboardPage);

function setActive(key) {
  active.value = key;
  localStorage.setItem('compound-life-system-tab', key);
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">CL</div>
        <div>
          <strong>复利人生系统</strong>
          <span>长期主义执行台</span>
        </div>
      </div>

      <nav class="nav-list" aria-label="主导航">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
          :class="{ active: active === tab.key }"
          type="button"
          @click="setActive(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main class="main-panel">
      <component :is="current" />
    </main>

    <nav class="mobile-tabs" aria-label="移动端导航">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: active === tab.key }"
        @click="setActive(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>
