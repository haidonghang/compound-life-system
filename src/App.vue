<script setup>
import { computed } from 'vue';
import TodayPage from './pages/TodayPage.vue';
import GoalsHubPage from './pages/GoalsHubPage.vue';
import ReviewHubPage from './pages/ReviewHubPage.vue';
import SyncPanel from './components/SyncPanel.vue';
import { useAppStore } from './store/useAppStore';

const { getters, setActiveDesk } = useAppStore();

const tabs = [
  { key: 'today', label: '今日台', component: TodayPage },
  { key: 'goals', label: '目标台', component: GoalsHubPage },
  { key: 'review', label: '复盘台', component: ReviewHubPage },
];

const active = computed(() => getters.activeDesk.value);
const current = computed(() => tabs.find((tab) => tab.key === active.value)?.component || TodayPage);
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">CL</div>
        <div>
          <strong>复利人生系统</strong>
          <span>长期目标执行系统 V3.1.4</span>
        </div>
      </div>

      <nav class="nav-list" aria-label="主导航">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
          :class="{ active: active === tab.key }"
          type="button"
          @click="setActiveDesk(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main class="main-panel">
      <SyncPanel />
      <component :is="current" />
    </main>

    <nav class="mobile-tabs" aria-label="移动端导航">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: active === tab.key }"
        @click="setActiveDesk(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>
