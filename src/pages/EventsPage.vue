<script setup>
import { reactive } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';
import { todayKey } from '../utils/date';

const { state, getters, eventTypeLabel, addEvent, deleteEvent } = useAppStore();
const form = reactive({
  date: todayKey(),
  type: 'positive',
  title: '',
  description: '',
});

function submit() {
  if (!form.title.trim()) return;
  addEvent(form);
  Object.assign(form, { date: todayKey(), type: 'positive', title: '', description: '' });
}
</script>

<template>
  <PageHeader title="事件页" eyebrow="Daily Signals" />

  <section class="layout-with-form">
    <form class="panel form-panel" @submit.prevent="submit">
      <h2>记录事件</h2>
      <label>
        日期
        <input v-model="form.date" type="date" />
      </label>
      <label>
        类型
        <select v-model="form.type">
          <option v-for="type in getters.eventTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
      </label>
      <label>
        标题
        <input v-model.trim="form.title" required placeholder="例如：完成了一次高质量汇报" />
      </label>
      <label>
        说明
        <textarea v-model.trim="form.description" rows="4" placeholder="发生了什么，对你有什么信号意义"></textarea>
      </label>
      <button class="primary-btn" type="submit">保存事件</button>
    </form>

    <div class="panel">
      <div class="panel-title">
        <h2>事件记录</h2>
        <span>{{ state.events.length }} 条</span>
      </div>
      <div v-if="!state.events.length" class="empty-state">把重要事件留下来，复盘时才有材料。</div>
      <article v-for="event in state.events" :key="event.id" class="record-card">
        <div class="record-main">
          <span class="small-label">{{ event.date }} · {{ eventTypeLabel(event.type) }}</span>
          <h3>{{ event.title }}</h3>
          <p>{{ event.description || '未填写说明' }}</p>
        </div>
        <div class="record-actions">
          <button class="danger-btn" type="button" @click="deleteEvent(event.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
