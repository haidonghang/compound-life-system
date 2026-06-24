<script setup>
import PageHeader from '../components/PageHeader.vue';
import StatCard from '../components/StatCard.vue';
import { useAppStore } from '../store/useAppStore';

const { getters } = useAppStore();
</script>

<template>
  <PageHeader title="数据页" eyebrow="Growth Data" />

  <section class="stat-grid">
    <StatCard label="连续执行天数" :value="`${getters.streakDays.value} 天`" hint="完成任务或复盘" />
    <StatCard label="今日完成率" :value="`${getters.todayCompletionRate.value}%`" hint="今日任务口径" />
    <StatCard label="今日复利分" :value="getters.compoundScore.value" hint="优先级与质量加权" />
  </section>

  <section class="content-grid two">
    <div class="panel">
      <div class="panel-title">
        <h2>最近 7 天完成率</h2>
      </div>
      <div class="bar-list">
        <div v-for="day in getters.sevenDayRates.value" :key="day.date" class="bar-row">
          <span>{{ day.label }}</span>
          <div class="bar-track"><i :style="{ width: `${day.rate}%` }"></i></div>
          <strong>{{ day.rate }}%</strong>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        <h2>各类别任务数量</h2>
      </div>
      <div class="bar-list">
        <div v-for="item in getters.categoryTaskCounts.value" :key="item.category" class="bar-row">
          <span>{{ item.category }}</span>
          <div class="bar-track">
            <i :style="{ width: `${Math.min(100, item.count * 12)}%` }"></i>
          </div>
          <strong>{{ item.done }}/{{ item.count }}</strong>
        </div>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-title">
      <h2>最常拖延任务</h2>
      <span>按延期天数排序</span>
    </div>
    <div v-if="!getters.delayedTasks.value.length" class="empty-state">当前没有延期任务。</div>
    <article v-for="task in getters.delayedTasks.value" :key="task.id" class="list-item">
      <div>
        <div class="item-title">{{ task.title }}</div>
        <div class="item-meta">{{ task.category }} · {{ task.priority }}</div>
      </div>
      <span class="status-pill paused">延期 {{ task.delayedDays }} 天</span>
    </article>
  </section>
</template>
